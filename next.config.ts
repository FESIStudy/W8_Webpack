import path from "path";

import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import withPWA from "next-pwa";
import TerserPlugin from "terser-webpack-plugin";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";

const withBundle = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withPWAWrapper = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
}) as (config: NextConfig) => NextConfig;

const nextConfig: NextConfig = withBundle(
  withPWAWrapper({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true, // 서비스 워커 자동 등록
    skipWaiting: true, // 업데이트 즉시 반영
    publicExcludes: ["!_next/static/**", "!_next/server/**"], // Netlify에서 PWA 적용을 위한 설정 추가
    runtimeCaching: [
      {
        urlPattern:
          /^https:\/\/codeit-doit.s3.ap-northeast-2.amazonaws.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "s3-images",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1년
          },
        },
      },
      {
        urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "cdn-resources",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7일
          },
        },
      },
    ],
    reactStrictMode: true,
    images: {
      domains: process.env.NEXT_PUBLIC_IMAGE_DOMAINS?.split(",") || [],
      remotePatterns: [
        {
          protocol: "https",
          hostname: "codeit-doit.s3.ap-northeast-2.amazonaws.com",
        },
      ],
      minimumCacheTTL: 86400,
    },
    headers: async () => [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
    ],
    webpack: (config, { isServer }) => {
      // Output 설정 추가
      config.output = {
        ...config.output,
        filename: "static/chunks/[name].[contenthash].js",
        chunkFilename: "static/chunks/[name].[contenthash].js",
      };

      // Alias 설정
      config.resolve.alias = {
        ...config.resolve.alias,
        "@components": path.resolve(__dirname, "src/components"),
        "@utils": path.resolve(__dirname, "src/utils"),
      };

      // Tree Shaking 활성화
      config.optimization = {
        ...config.optimization,
        usedExports: true,
      };

      // 번들 분석 도구 추가
      if (process.env.ANALYZE === "true") {
        config.plugins.push(new BundleAnalyzerPlugin());
      }

      // Terser로 JS 압축 & console.log 삭제
      if (!isServer) {
        if (!config.optimization.minimizer) {
          config.optimization.minimizer = [];
        }
        config.optimization.minimizer.push(
          new TerserPlugin({
            parallel: true, // 병렬 실행
            terserOptions: {
              compress: {
                drop_console: true, // console.log 삭제
              },
            },
          }),
        );
      }

      return config;
    },
  }) as NextConfig,
);

export default withSentryConfig(nextConfig, {
  org: "xeun-lab",
  project: "thunderting",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true,
});
