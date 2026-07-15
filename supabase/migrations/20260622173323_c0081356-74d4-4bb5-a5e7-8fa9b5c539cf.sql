CREATE OR REPLACE FUNCTION public.enter_demo_mode()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_source_id uuid;
  v_instance_id uuid;
  v_group_id uuid;
  v_groups text[] := ARRAY[
    'Vila Arens Unida','Moradores Ivoturucaia','Zona Oeste Ação','Centro Jundiaí','Anhangabaú Ativo',
    'Jardim Tamoio','Vianelo Cidadão','Eloy Chaves','Engordadouro Bairro','Ponte de Campinas',
    'Maringá Saúde','Colônia · Distrito Rural'
  ];
  v_neighborhoods text[] := ARRAY[
    'Vila Arens','Ivoturucaia','Zona Oeste','Centro','Anhangabaú','Tamoio','Vianelo','Eloy Chaves','Engordadouro','Ponte Campinas','Maringá','Colônia'
  ];
  v_topics text[] := ARRAY['UBS Maringá','IPTU 2026','Transporte zona leste','Buracos Vila Arens','Iluminação Vianelo','Creche Eloy Chaves','Coleta de lixo','Segurança Centro','Obras Anhangabaú','Educação','Saúde','Mobilidade'];
  i int;
  d date;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT id INTO v_org_id FROM organizations WHERE is_demo = true AND name = 'Prefeitura de Jundiaí (DEMO)' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, city, state, slug, author_hash_salt, is_demo, created_by)
    VALUES ('Prefeitura de Jundiaí (DEMO)','Jundiaí','SP','jundiai-demo', encode(extensions.gen_random_bytes(16),'hex'), true, v_user_id)
    RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO org_members (org_id, user_id, role) VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM whatsapp_groups WHERE org_id = v_org_id) THEN
    RETURN v_org_id;
  END IF;

  INSERT INTO sources (org_id, kind, label, config, is_active)
  VALUES (v_org_id, 'whatsapp', 'WhatsApp · Gabinete Jundiaí', '{"demo":true}'::jsonb, true)
  RETURNING id INTO v_source_id;

  INSERT INTO whatsapp_instances (org_id, source_id, evolution_base_url, evolution_api_key, instance_name, connected_phone, connection_status, last_seen_at)
  VALUES (v_org_id, v_source_id, 'https://demo.evolution.local', 'demo', 'gabinete-jundiai', '+55 11 99000-0000', 'open', now())
  RETURNING id INTO v_instance_id;

  FOR i IN 1..array_length(v_groups,1) LOOP
    INSERT INTO whatsapp_groups (org_id, instance_id, remote_jid, subject, participant_count, is_monitored, neighborhood_tag, monitored_at, monitored_by, tags)
    VALUES (v_org_id, v_instance_id, 'demo-'||i||'@g.us', v_groups[i], 80 + (random()*250)::int, true, v_neighborhoods[i], now() - interval '60 days', v_user_id, ARRAY['demo'])
    RETURNING id INTO v_group_id;

    FOR d IN SELECT generate_series(current_date - 89, current_date, '1 day'::interval)::date LOOP
      INSERT INTO daily_aggregates (org_id, group_id, bucket_date, message_count, avg_sentiment, top_topics, top_neighborhoods, risk_events)
      VALUES (
        v_org_id, v_group_id, d,
        20 + (random()*120)::int,
        round((random()*1.6 - 0.8)::numeric, 2),
        jsonb_build_array(jsonb_build_object('label', v_topics[1 + (random()*11)::int], 'count', (random()*40)::int)),
        jsonb_build_array(jsonb_build_object('label', v_neighborhoods[i], 'count', (random()*60)::int)),
        (random()*3)::int
      );
    END LOOP;

    INSERT INTO raw_messages (org_id, source_id, group_id, external_id, author_hash, content, posted_at, analysis_status)
    SELECT
      v_org_id, v_source_id, v_group_id,
      'demo-'||v_group_id||'-'||g,
      md5('author-'||(g % 25)),
      (ARRAY[
        'Vocês viram a fila absurda na UBS Maringá hoje?',
        'O IPTU de 2026 veio com aumento mesmo, tá impossível',
        'Ônibus da zona leste atrasou 40 minutos de novo',
        'Buraco enorme na rua principal da Vila Arens, alguém avisa o gabinete',
        'Iluminação do Vianelo melhorou bastante, parabéns à prefeitura',
        'A creche do Eloy Chaves ainda sem vaga, é vergonhoso',
        'Coleta de lixo passou no horário hoje, anota aí',
        'Centro tá perigoso à noite, precisa de mais ronda',
        'A obra do Anhangabaú parou faz duas semanas',
        'Educação infantil melhorando, vejo movimento positivo',
        'Posto de saúde sem médico de novo, segunda-feira de manhã',
        'Mobilidade aqui é um caos, ciclovia abandonada'
      ])[1 + (g % 12)],
      now() - (random()*90 || ' days')::interval,
      'done'
    FROM generate_series(1, 50) g;
  END LOOP;

  INSERT INTO message_analyses (org_id, message_id, sentiment, intensity, topic, neighborhood, mentioned_opponents, mentioned_entities, mentioned_allies, is_actionable, risk_score, summary, model_version)
  SELECT
    v_org_id, m.id,
    round((random()*1.6 - 0.8)::numeric, 2),
    round((random()*0.8 + 0.2)::numeric, 2),
    v_topics[1 + (random()*11)::int],
    v_neighborhoods[1 + (random()*11)::int],
    '{}'::text[], '{}'::text[], '{}'::text[],
    random() > 0.7,
    (random()*100)::int,
    substring(m.content, 1, 120),
    'demo-v1'
  FROM raw_messages m WHERE m.org_id = v_org_id;

  INSERT INTO topics (org_id, bucket_date, label, message_count, avg_sentiment, max_risk, top_neighborhoods, sample_message_ids, trend)
  SELECT v_org_id, current_date,
    v_topics[t.n], 50 + (random()*200)::int, round((random()*1.4 - 0.7)::numeric, 2), 60 + (random()*40)::int,
    jsonb_build_array(jsonb_build_object('label', v_neighborhoods[t.n], 'count', (random()*40)::int)),
    '{}'::uuid[],
    (ARRAY['up','up','flat','down'])[1 + (random()*3)::int]
  FROM generate_series(1,6) AS t(n);

  INSERT INTO alerts (org_id, level, topic, neighborhood, summary, recommended_action, evidence_message_ids) VALUES
    (v_org_id, 'vermelho', 'UBS Maringá · agendamento', 'Maringá', 'Reclamações em 3 grupos + 22 comentários negativos em portais sobre agendamento da UBS Maringá. Estágio: borbulhando há 48h.', 'Visita oficial à UBS com câmera + nota técnica em 24h.', '{}'),
    (v_org_id, 'vermelho', 'IPTU 2026 · reajuste', 'Centro', 'Discussão crescente sobre reajuste do IPTU 2026 em grupos da zona central. Vereador da oposição já replicou.', 'Coletiva técnica sobre cálculo do IPTU.', '{}'),
    (v_org_id, 'laranja', 'Transporte zona leste', 'Eloy Chaves', '8 reclamações em 24h sobre atrasos da linha 412. Tendência de alta.', 'Cobrar concessionária e responder em 48h.', '{}'),
    (v_org_id, 'laranja', 'Buracos Vila Arens', 'Vila Arens', 'Moradores cobrando tapa-buracos há 9 dias em 2 grupos.', 'Programar operação tapa-buracos esta semana.', '{}'),
    (v_org_id, 'amarelo', 'Iluminação Vianelo', 'Vianelo', 'Sentimento positivo crescente após troca de postes. Oportunidade de comunicação.', 'Publicar resultado com fotos.', '{}'),
    (v_org_id, 'amarelo', 'Creche Eloy Chaves', 'Eloy Chaves', 'Lista de espera mencionada em 4 grupos da semana.', 'Atualizar fila pública.', '{}');

  INSERT INTO reports (org_id, kind, period_start, period_end, title, markdown, data, model_version, generated_at)
  SELECT v_org_id, 'daily',
    (current_date - r.n)::timestamptz, (current_date - r.n + 1)::timestamptz,
    'Relatório diário · ' || to_char(current_date - r.n, 'DD/MM/YYYY'),
    E'# Resumo do dia\n\n- 1.247 mensagens analisadas\n- 3 alertas abertos\n- Tema quente: UBS Maringá\n\n## Bairros em destaque\nMaringá (negativo), Vianelo (positivo), Centro (neutro).',
    '{"demo":true}'::jsonb, 'demo-v1', (current_date - r.n + interval '8 hours')::timestamptz
  FROM generate_series(0,7) AS r(n);

  INSERT INTO reports (org_id, kind, period_start, period_end, title, markdown, data, model_version, generated_at)
  SELECT v_org_id, 'weekly',
    (current_date - (r.n*7))::timestamptz, (current_date - (r.n*7) + 7)::timestamptz,
    'Relatório semanal · semana ' || to_char(current_date - (r.n*7), 'IW/IYYY'),
    E'# Panorama semanal\n\n- Sentimento médio: -0.12 (queda leve)\n- 5 narrativas em formação\n- Adversário mais ativo: Vereador Parimoschi',
    '{"demo":true}'::jsonb, 'demo-v1', now()
  FROM generate_series(0,2) AS r(n);

  INSERT INTO reports (org_id, kind, period_start, period_end, title, markdown, data, model_version, generated_at)
  VALUES (v_org_id, 'monthly', (current_date - 30)::timestamptz, current_date::timestamptz,
    'Análise mensal · ' || to_char(current_date - 15, 'TMMonth/YYYY'),
    E'# Análise de mandato — mês\n\n- Aprovação inferida: 54% (+2pp)\n- 3 crises evitadas\n- Recomendações estratégicas anexas',
    '{"demo":true}'::jsonb, 'demo-v1', now());

  INSERT INTO tracked_members (org_id, display_name, role, neighborhood, tags)
  VALUES
    (v_org_id, 'Dona Cida (Vila Arens)', 'lider_bairro', 'Vila Arens', ARRAY['aliada','líder']),
    (v_org_id, 'Seu Joaquim (Ivoturucaia)', 'lider_bairro', 'Ivoturucaia', ARRAY['neutro']),
    (v_org_id, 'Marcos · pastor zona oeste', 'lider_bairro', 'Zona Oeste', ARRAY['aliado']),
    (v_org_id, 'Beatriz · presidente associação Centro', 'lider_bairro', 'Centro', ARRAY['neutro']),
    (v_org_id, 'Carlos · Vianelo Cidadão', 'lider_bairro', 'Vianelo', ARRAY['aliado']),
    (v_org_id, 'Adriana · creche Eloy Chaves', 'lider_bairro', 'Eloy Chaves', ARRAY['atenção']),
    (v_org_id, 'Renato · militante Anhangabaú', 'militante', 'Anhangabaú', ARRAY['oposição']),
    (v_org_id, 'Vereador Parimoschi', 'vereador', NULL, ARRAY['oposição','crítico']),
    (v_org_id, 'Vereador Daniel Lima', 'vereador', NULL, ARRAY['oposição']),
    (v_org_id, 'Vereadora Marta Souza', 'vereador', NULL, ARRAY['aliada']),
    (v_org_id, 'Júlio · admin grupo Tamoio', 'lider_bairro', 'Tamoio', ARRAY['neutro']),
    (v_org_id, 'Fernanda · saúde Maringá', 'lider_bairro', 'Maringá', ARRAY['atenção']),
    (v_org_id, 'Pedro · Engordadouro', 'lider_bairro', 'Engordadouro', ARRAY['neutro']),
    (v_org_id, 'Sandra · Ponte Campinas', 'lider_bairro', 'Ponte Campinas', ARRAY['aliada']),
    (v_org_id, 'Lúcio · militante Colônia', 'militante', 'Colônia', ARRAY['neutro']);

  INSERT INTO member_daily_stats (org_id, member_id, bucket_date, message_count, avg_sentiment, insults_count, avg_response_minutes)
  SELECT v_org_id, tm.id, dd::date,
    (random()*30)::int + 1,
    round((random()*1.6 - 0.6)::numeric, 2),
    (random()*3)::int,
    round((random()*120 + 5)::numeric, 1)
  FROM tracked_members tm,
       generate_series(current_date - 29, current_date, '1 day'::interval) dd
  WHERE tm.org_id = v_org_id;

  INSERT INTO org_adversaries (org_id, display_name, handle, role, party, activity_score, sentiment, top_topics, recent_actions) VALUES
    (v_org_id, 'Vereador Parimoschi', '@parimoschi', 'Vereador', 'PSOL', 87, -0.42,
      '["UBS Maringá","IPTU","Transporte"]'::jsonb,
      '[{"date":"hoje","action":"Post no Instagram cobrando posicionamento sobre UBS Maringá"},{"date":"ontem","action":"Compartilhou matéria da Tribuna"}]'::jsonb),
    (v_org_id, 'Vereador Daniel Lima', '@daniellima', 'Vereador', 'PT', 62, -0.28,
      '["Educação","Creches"]'::jsonb,
      '[{"date":"2d","action":"Discurso na câmara sobre fila de creches"}]'::jsonb),
    (v_org_id, 'Bloco Jundiaí Justa', '@jundiaijusta', 'Movimento', NULL, 41, -0.31,
      '["IPTU","Transparência"]'::jsonb,
      '[{"date":"3d","action":"Live com 1.2k visualizações sobre IPTU"}]'::jsonb),
    (v_org_id, 'Portal Tribuna · opinião', '@tribunajundiai', 'Imprensa', NULL, 55, -0.15,
      '["Mobilidade","Saúde"]'::jsonb,
      '[{"date":"hoje","action":"Editorial crítico sobre obra do Anhangabaú"}]'::jsonb);

  INSERT INTO lgpd_events (org_id, event_type, subject_kind, subject_id, details)
  SELECT v_org_id,
    (ARRAY['collection','anonymization','retention_purge','export_request','consent'])[1 + (random()*4)::int],
    'message', md5('lgpd-'||s.n),
    jsonb_build_object('source','whatsapp','note','operação automática registrada para auditoria')
  FROM generate_series(1,40) AS s(n);

  INSERT INTO audit_log (org_id, actor_id, action, target_kind, target_id, metadata)
  SELECT v_org_id, v_user_id,
    (ARRAY['sync.completed','alert.created','report.generated','vocabulary.updated','member.tracked'])[1 + (random()*4)::int],
    'system', 'demo-'||s.n, '{"demo":true}'::jsonb
  FROM generate_series(1,25) AS s(n);

  INSERT INTO org_vocabulary (org_id, kind, value, aliases) VALUES
    (v_org_id, 'neighborhood', 'Vila Arens', ARRAY['vila arens','arens']),
    (v_org_id, 'neighborhood', 'Maringá', ARRAY['maringa']),
    (v_org_id, 'neighborhood', 'Ivoturucaia', ARRAY['ivotu']),
    (v_org_id, 'neighborhood', 'Vianelo', ARRAY['vianello']),
    (v_org_id, 'opponent', 'Parimoschi', ARRAY['vereador parimoschi']),
    (v_org_id, 'facility', 'UBS Maringá', ARRAY['posto maringa']),
    (v_org_id, 'sensitive_term', 'IPTU', ARRAY['imposto predial']),
    (v_org_id, 'news_domain', 'tribunadejundiai.com.br', ARRAY['tribuna de jundiai']),
    (v_org_id, 'news_domain', 'bomdiajundiai.com.br', ARRAY['bom dia jundiai']);

  RETURN v_org_id;
END;
$function$;