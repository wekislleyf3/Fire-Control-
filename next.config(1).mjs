/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Por padrão, o Next.js App Router guarda no navegador por até 30s
    // o conteúdo de páginas dinâmicas (Dashboard, Alertas), mesmo com
    // force-dynamic no servidor. Isso fazia parecer que os painéis não
    // atualizavam ao navegar pelo menu. Zerando aqui, cada navegação
    // busca dados novos no banco.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
