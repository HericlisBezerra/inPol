/** Consolidated v2 navigation — 12 legacy items collapsed to 7 primary. */
export const V2_NAV = [
  { label: "Painel", to: "/painel" },
  { label: "Alertas", to: "/alertas" },
  // Casos vem logo após Alertas de propósito: o alerta é o disparo pontual, o caso é
  // o assunto ao longo do tempo. Sem entrada no nav, o dossiê só era alcançável a
  // partir de um alerta — e assunto que esfriou (sem alerta aberto) ficava inacessível.
  { label: "Casos", to: "/casos" },
  { label: "Território", to: "/territorio" },
  { label: "Sinais", to: "/sinais" },
  { label: "Rede", to: "/rede" },
  { label: "Câmara", to: "/camara" },
  { label: "Relatórios", to: "/relatorios" },
] as const;
