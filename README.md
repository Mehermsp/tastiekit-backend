Shared backend for TastieKit.

Use this folder as the single backend launch location for the repo.

How it works

1. Configure environment

    - Set DB credentials in `backend/.env`
    - Use `backend/.env.example` as the template for required keys

2. Start the API

    npm start

Current structure

- `backend/index.js` bootstraps the backend from this folder
- `backend/app.js` is the main Express entrypoint
- backend source now lives in `backend/routes`, `backend/config`, `backend/services`, and related folders
- restaurant PWA static assets are served from `tastiekit-restaurant/dist`
- dependencies now live in `backend/node_modules`
