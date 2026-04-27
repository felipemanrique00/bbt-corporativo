/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // pdfjs-dist precisa ser tratada como pacote externo no servidor
  serverExternalPackages: ['pdfjs-dist'],

  webpack: (config, { isServer }) => {
    // Habilita topLevelAwait para a pdfjs-dist (remove o warning amarelo)
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
      asyncWebAssembly: true,
    }

    // pdfjs-dist só roda no cliente (navegador), não no servidor
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist': false,
      }
    }

    return config
  },
}

export default nextConfig
