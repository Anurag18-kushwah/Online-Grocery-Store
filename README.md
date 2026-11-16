# GrocerAI — Smarter Choices. Fresher Living.

**An explainable, AI-assisted online grocery shopping platform.**

[![React](https://img.shields.io/badge/React-Frontend-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-Build_Tool-646CFF?logo=vite)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-API-black?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb)](https://www.mongodb.com/)

GrocerAI is a full-stack grocery shopping web application designed to make grocery shopping smarter, easier, and more transparent. It combines personalized product recommendations, intelligent filtering, basket optimization, recipe planning, product substitutions, and an optional AI-powered shopping assistant.

> **Complete Project Documentation:** [View GrocerAI Documentation](docs/project-documentation/README.md)

The documentation includes the Software Requirements Specification (SRS), system architecture, UML diagrams, DFD, ER diagrams, database design, API reference, testing, user manual, and deployment guide.

---

## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Configuration](#database-configuration)
- [AI Provider Configuration](#ai-provider-configuration)
- [Product Images](#product-images)
- [Testing](#testing)
- [Limitations and Future Scope](#limitations-and-future-scope)
- [Migration Decisions](#migration-decisions)
- [Project Documentation](#project-documentation)

---

## Key Features

| Feature | Description |
|---|---|
| **Intelligence Engine** | Deterministic product recommendations using cart activity, browsing history, consent-based purchase history, value per unit, discounts, popularity, and budget fit. Recommendations include explainable reasons. |
| **Smart Filter 2.0** | 15+ combinable filters with filter chips, result counts, clear-all functionality, and empty-state suggestions. |
| **Natural Language Filters** | Converts user search phrases into structured filters using a rule-based parser and optional schema-validated LLM output. |
| **Basket Optimizer** | Analyzes budget, expensive items, duplicates, avoid-list conflicts, pack sizes, and alternative products. Suggested changes require user approval. |
| **Smart Substitution** | Suggests alternatives based on category, unit, dietary preferences, allergens, unit price, brand, history, and rating. |
| **Recipe to Cart** | Provides 42 built-in recipes, ingredient matching, serving-size scaling, pantry support, and budget-based meal planning. |
| **AI Shopping Copilot** | Assists with product search, basket operations, recipes, meal planning, comparisons, and substitutions. Supports optional AWS Bedrock and OpenAI-compatible providers. |
| **User Authentication** | Registration, login, password hashing using bcrypt, and JWT-based authentication. |
| **Shopping Cart & Wishlist** | Guest carts, cart merging, wishlist management, and personalized shopping preferences. |
| **Checkout & Orders** | Stock-validated checkout, order management, cancellation, and restocking workflows. |
| **Admin Dashboard** | Product, category, inventory, order, and statistics management. |

## Technology Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express.js
- REST API
- JWT Authentication
- bcrypt
- Zod Validation

### Database
- MongoDB
- Mongoose
- Optional local file-backed development store

### AI Integration
- AWS Bedrock
- OpenAI-compatible LLM providers
- Rule-based natural language processing
- Deterministic recommendation and optimization services

---

## Project Structure

```text
grocerai/
│
├── client/
│   └── src/
│       ├── pages/
│       ├── components.jsx
│       ├── context.jsx
│       ├── api.js
│       └── styles.css
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── models/
│   │   ├── data/
│   │   ├── services/
│   │   ├── ai/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── scripts/
│   │
│   ├── test/
│   └── public/
│
├── docs/
│   ├── API.md
│   ├── DEMO_SCRIPT.md
│   ├── ADMIN_ORDER_NOTIFICATIONS.md
│   ├── RAZORPAY_TESTING.md
│   └── project-documentation/
│
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

The separate Android project at the repository root has been left untouched. GrocerAI is maintained as an independent web application inside the `grocerai/` directory.

---

## Getting Started

### Prerequisites

Make sure you have installed:

- Node.js 20 or later
- npm
- Git
- MongoDB (optional if using the local development store)

### 1. Clone the repository

```bash
git clone https://github.com/Anurag18-kushwah/Online-Grocery-Store.git
```

### 2. Navigate to the web application

```bash
cd Online-Grocery-Store/grocerai
```

### 3. Install dependencies

```bash
npm run install:all
```

### 4. Configure environment variables

Create the server environment file using the supplied example:

```bash
cp .env.example server/.env
```

Configure the required values in `server/.env`, including:

- `JWT_SECRET`
- `MONGODB_URI` for MongoDB mode
- `STORE_MODE=local` for local development mode

Never commit `.env` files, API keys, passwords, or other secrets.

---

## Database Configuration

### Option A: MongoDB / MongoDB Atlas

1. Create a MongoDB database or Atlas cluster.
2. Configure database access.
3. Allow your IP address through Network Access.
4. Copy the MongoDB connection URI.
5. Add it to `server/.env`:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_random_secret
```

Seed the database:

```bash
npm run seed
```

Build the frontend:

```bash
npm run build
```

Start the application:

```bash
npm start
```

Application URL:

```text
http://localhost:4000
```

### Option B: Local Development Store

GrocerAI also supports a file-backed local development store without requiring MongoDB.

Add the following to `server/.env`:

```env
STORE_MODE=local
JWT_SECRET=your_secure_random_secret
```

Then run:

```bash
npm run build
npm run start:local
```

The local store is intended for development and testing, not production deployment.

---

## Development Mode

For development with hot reload, open two terminals from the GrocerAI project directory.

**Terminal 1 — Backend**

```bash
npm run dev:server
```

**Terminal 2 — Frontend**

```bash
npm run dev:client
```

Frontend:

```text
http://localhost:5173
```

The Vite development server proxies API requests through `/api`.

---

## AI Provider Configuration

GrocerAI works without an external AI API key. Its core shopping features use deterministic logic and built-in data.

For optional LLM integration, configure the provider in `server/.env`.

### AWS Bedrock

```env
LLM_PROVIDER=bedrock
AWS_REGION=your_aws_region
BEDROCK_MODEL_ID=your_model_id
```

Configure AWS credentials through environment variables or an appropriate IAM role.

### OpenAI-compatible Provider

```env
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=your_api_base_url
LLM_API_KEY=your_api_key
LLM_MODEL=your_model_name
```

API keys remain on the backend and are never sent to the browser.

The AI Copilot uses real application tools for supported shopping operations. LLM-generated recipes are labelled as unverified. If an AI provider is unavailable, deterministic fallback responses are used where supported.

---

## One-Command Setup

The project includes an optional interactive setup script:

```bash
npm run setup
```

It helps configure:

1. **AI chat provider:** Groq, Gemini, or Ollama.
2. **Product images:** Unsplash, Pixabay, or Pexels.

The script tests the selected configuration, saves settings to `server/.env`, and downloads product images when configured.

After setup, restart the application and refresh the browser.

### Product Image Selection

To manually select product photos:

```bash
npm run photos:pick
```

The local photo picker runs at:

```text
http://localhost:4400
```

Custom images placed in `server/public/images/products/` take priority and are not overwritten by the downloader.

Keep image attribution information in `CREDITS.json` where applicable.

---

## Docker Deployment

The repository includes Docker configuration.

Example command:

```bash
docker compose up --build
```

Set a secure `JWT_SECRET` through the environment before starting the application.

After the containers are running, seed the database if required:

```bash
docker compose exec app node server/src/scripts/seed.js
```

The Docker workflow was not executed in the original authoring environment; verify it in your deployment environment before relying on it.

---

## Testing

Run the automated test suite:

```bash
npm test
```

The documented test coverage includes:

- Product filtering
- Recommendation scoring and consent gating
- Basket optimization
- Product substitutions
- Recipe scaling and cost calculations
- Natural-language filter parsing
- LLM fallback and error handling
- Store contract tests
- Authentication and API workflows
- Cart, checkout, order cancellation, and authorization

The previously reported test counts were 64 tests using the default local store and 81 when a MongoDB-protocol-compatible test server was available. These are historical results, not a guarantee that the current checkout passes without rerunning the tests.

---

## Limitations and Future Scope

### Current Limitations

- Recommendation ranking uses deterministic, hand-weighted scoring; it is not a trained machine learning model.
- Basket optimization uses a greedy heuristic, not a globally optimal algorithm.
- Payments are mock/Cash on Delivery workflows; there is no live payment gateway.
- No live delivery tracking or external price comparison is implemented.
- Inventory is not synchronized with external suppliers.
- Seed nutrition information is approximate and depends on the quality of available product data.
- Rate limiting is in-memory and intended for a single-process deployment.
- Recommendation event logging is modelled but not fully wired.
- Real LLM services and deployment integrations require independent configuration and verification.

### Future Scope

- Machine learning-based personalized recommendations.
- Live payment gateway integration.
- Real-time inventory synchronization.
- Delivery partner integration and order tracking.
- Advanced analytics for shopping behaviour.
- Improved nutrition and allergen data quality.
- Scalable distributed rate limiting.
- Expanded AI-assisted meal planning.

---

## Migration Decisions

The repository originally contained a native Android application associated with a separate Java and PostgreSQL Nearby Shops backend.

That Android project was left intact. GrocerAI was developed as a separate React, Express, and MongoDB-based web application inside the `grocerai/` directory.

Only the repository's `.gitignore` was extended as part of the web application migration.

---

## Project Documentation

The complete college and technical documentation is available in the following directory:

**[Open Complete GrocerAI Documentation](docs/project-documentation/README.md)**

Documentation includes:

1. Project Overview
2. Software Requirements Specification (SRS)
3. System Architecture
4. UML Diagrams
5. Data Flow Diagram (DFD) and ER Diagrams
6. Database Design
7. API Reference
8. Testing and Quality Assurance
9. User Manual
10. Installation and Deployment
11. Requirements Traceability Matrix
12. Limitations and Future Scope
13. References and Glossary

---

## Security Notes

- Never commit `.env` files or API credentials.
- Use a strong, unique JWT secret.
- Change or remove default demo credentials before public deployment.
- Do not commit runtime database files or private user data.
- Validate all production environment variables before deployment.

---

## Author

**Anurag Kushwaha**

B.Tech — Information Technology

GitHub: [Anurag18-kushwah](https://github.com/Anurag18-kushwah)

---

*GrocerAI — Smarter Choices. Fresher Living.*
