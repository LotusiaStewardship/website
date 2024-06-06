# Lotusia.org made with Nuxt.js 3 / Nuxt UI Pro v1.2

Features:

- Optimized for SEO
- Light / Dark mode
- Fully responsive on mobile / desktop / tablet devices

## Installation (tested on node >18)

`cd` to the app folder and run

```
yarn
```

## Run Development

```
yarn dev
```

## Run Development with Docker

You should avoid developing with Docker as it is
mostly required for production build and it significantly
decreases the feedback loop for making changes and seeing them.
(you need to rebuild the container each time you make a change)


1. Build container

```
sudo docker build . -t lotusia/website
```

2. Run container

```
sudo docker run -it -p 8080:8080 lotusia/website:latest
```

You will then be able to visit the app at localhost:8080

## Build for CDN (SSR)
**NOTE**: Nuxt UI Pro requires an activation key for generating the production website. Refer to the `.env.example` file for more details.

```
yarn generate
```

Credits:

Based on [Nuxt UI Pro - SaaS](https://github.com/nuxt-ui-pro/saas) template