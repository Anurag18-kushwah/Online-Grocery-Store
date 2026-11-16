# GrocerAI — Smarter Choices. Fresher Living.
**Complete project documentation | Version 1.0 | Web application scope**

GrocerAI is a full-stack grocery shopping web application. This documentation covers the React/Vite client, Node.js/Express API, MongoDB/Mongoose persistence option, local development store, deterministic shopping intelligence, and optional LLM integration. The separate Android project at repository root is outside this report's scope.

## Contents
- 01 Project overview
- 02 Software Requirements Specification
- 03 System architecture
- 04 UML diagrams
- 05 DFD and ER diagrams
- 06 Database design
- 07 API reference
- 08 Testing and QA
- 09 User manual
- 10 Installation and deployment
- 11 Traceability matrix
- 12 Limitations and future scope
- 13 References and glossary

## Stack
React, Vite, Node.js, Express, MongoDB/Mongoose, JWT, bcrypt, Zod validation, optional AWS Bedrock or OpenAI-compatible LLM.

## Quick start
Requires Node.js 20+ and npm. For MongoDB mode, a reachable MongoDB instance is required.
```bash
npm run install:all
# configure server environment using the supplied .env.example
npm run setup
npm run dev:server
npm run dev:client
```
Run `npm run` to inspect the exact scripts in your checked-out version. Never commit `.env`, credentials, or runtime database files.

**Accuracy notes:** recommendation ranking is deterministic hand-weighted scoring, not a trained ML model. Payment is mock/COD, not a live gateway. See the limitations and verification sections before submission.
