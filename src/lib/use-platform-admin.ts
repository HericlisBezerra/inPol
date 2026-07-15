import { useQuery } from "@tanstack/react-query";
import { amIPlatformAdmin } from "@/lib/admin.functions";

export function usePlatformAdmin() {
  const q = useQuery({
    queryKey: ["platform-admin"],
    queryFn: () => amIPlatformAdmin(),
    staleTime: 60_000,
  });
  return { isAdmin: q.data?.isAdmin ?? false, isLoading: q.isLoading };
}
