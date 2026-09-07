# NEXUS

## AI Engineering Intelligence Platform

NEXUS is an AI-powered engineering intelligence platform designed to help software teams understand, plan, and audit engineering work through structured, context-aware interaction with an AI engineering assistant.

Rather than functioning as a conventional question-and-answer chatbot, NEXUS combines conversational AI with persistent project context, structured engineering data, authenticated user isolation, and cloud-native infrastructure.

The platform allows authenticated users to:

* Create and manage engineering projects
* Interact with an AI engineering assistant
* Maintain multi-turn conversations
* Preserve conversation context across sessions
* Generate structured engineering information
* Organize engineering planning information
* Record engineering decisions
* Review project audit information
* Maintain isolated project data

NEXUS was developed as a project for the **GenAI APAC Academy Cohort 3** and integrates Google Cloud, Firebase, and Gemini technologies.

---
# Running the Frontend

From the repository root:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:3000
```

---

# Running the Backend

From the repository root:

```bash
PYTHONPATH=. uvicorn backend.main:app --reload --port 8080
```

The backend will normally be available at:

```text
http://localhost:8080
```

---

# Running the Full Application

Run the backend in one terminal:

```bash
PYTHONPATH=. uvicorn backend.main:app --reload --port 8080
```

Run the frontend in another:

```bash
cd frontend
npm run dev
```

The local architecture becomes:

```text
Browser
   │
   ▼
localhost:3000
   │
   ▼
localhost:8080
   │
   ├── Firebase Authentication
   ├── Firestore
   └── Gemini API
```

---

## Table of Contents

* [Overview](#overview)
* [Problem Statement](#problem-statement)
* [Solution](#solution)
* [Objectives](#objectives)
* [Key Features](#key-features)
* [System Architecture](#system-architecture)
* [Application Architecture](#application-architecture)
* [High-Level Data Flow](#high-level-data-flow)
* [User Interaction Flow](#user-interaction-flow)
* [Technology Stack](#technology-stack)
* [Google Cloud and Firebase Services](#google-cloud-and-firebase-services)
* [Authentication](#authentication)
* [Authorization and User Isolation](#authorization-and-user-isolation)
* [Multi-Turn Gemini Interaction](#multi-turn-gemini-interaction)
* [Conversation Persistence](#conversation-persistence)
* [Engineering Intelligence Layer](#engineering-intelligence-layer)
* [Frontend Architecture](#frontend-architecture)
* [Backend Architecture](#backend-architecture)
* [Project Structure](#project-structure)
* [Data Model](#data-model)
* [API Architecture](#api-architecture)
* [Security Architecture](#security-architecture)
* [Environment Configuration](#environment-configuration)
* [Local Development](#local-development)
* [Running the Frontend](#running-the-frontend)
* [Running the Backend](#running-the-backend)
* [Running the Full Application](#running-the-full-application)
* [Testing](#testing)
* [Production Architecture](#production-architecture)
* [Firebase Hosting Deployment](#firebase-hosting-deployment)
* [Cloud Run Deployment](#cloud-run-deployment)
* [Secret Manager Configuration](#secret-manager-configuration)
* [Firebase Authentication Configuration](#firebase-authentication-configuration)
* [Firestore Configuration](#firestore-configuration)
* [CORS Configuration](#cors-configuration)
* [Challenge Requirements](#challenge-requirements)
* [Challenge Verification](#challenge-verification)
* [Engineering Decisions](#engineering-decisions)
* [Why NEXUS Is Not Just a Chatbot](#why-nexus-is-not-just-a-chatbot)
* [Failure Handling](#failure-handling)
* [Testing Strategy](#testing-strategy)
* [Limitations](#limitations)
* [Future Improvements](#future-improvements)
* [Development Workflow](#development-workflow)
* [Project Status](#project-status)
* [Validation Results](#validation-results)
* [Production Deployment Checklist](#production-deployment-checklist)
* [Security Checklist](#security-checklist)
* [Design Philosophy](#design-philosophy)
* [License](#license)
* [Author](#author)

---

# Overview

Modern software engineering involves significantly more than writing source code.

Engineering teams continuously need to reason about:

* Requirements
* System architecture
* Technical constraints
* Implementation strategies
* Dependencies
* Development planning
* Engineering decisions
* Testing strategies
* Security risks
* Technical debt
* System evolution
* Project traceability

Large language models can assist with many of these activities, but a conventional chatbot has an important limitation:

> A generic AI conversation does not inherently represent the persistent state of an engineering project.

A developer may explain a system architecture in one conversation and then have to explain the same context again later.

A technical decision may be discussed inside a chat but never become a structured project artifact.

A planning discussion may be disconnected from the engineering decisions that motivated it.

NEXUS addresses this problem by combining conversational AI with persistent engineering context.

The platform treats Gemini as an intelligence layer operating over project data rather than as an isolated chatbot.

The resulting system combines:

```text
Identity
    +
Project State
    +
Conversation History
    +
Engineering Context
    +
AI Reasoning
    +
Structured Persistence
```

into a single engineering intelligence platform.

---

# Problem Statement

Software projects accumulate large amounts of technical knowledge over their lifetime.

A typical project may contain:

```text
Project
├── Requirements
├── Architecture
├── Components
├── Technical Decisions
├── Implementation Plans
├── Development Tasks
├── Testing Information
├── Risks
└── Audit Information
```

At the same time, AI assistants are increasingly being used to support engineering activities.

However, a traditional AI interaction often looks like:

```text
Developer
    │
    ▼
Generic AI Chat
    │
    ▼
Temporary Response
```

This creates several problems.

## Context Fragmentation

Important engineering discussions become distributed across separate conversations.

## Repeated Context

Developers repeatedly need to provide project background to the AI.

## Unstructured AI Output

Useful engineering information may remain buried inside natural-language responses.

## Weak Project Continuity

A conversation does not necessarily correspond to the persistent state of the project.

## Data Isolation

A multi-user engineering platform must ensure that one user cannot access another user's project information.

## Credential Security

AI API credentials must remain outside the browser and source repository.

NEXUS is designed to address these issues through a persistent, authenticated, project-oriented architecture.

---

# Solution

NEXUS introduces an engineering intelligence layer around the Gemini API.

The platform connects:

```text
User
  │
  ▼
NEXUS Frontend
  │
  ▼
Firebase Authentication
  │
  ▼
FastAPI Backend
  │
  ├──────────────► Firestore
  │
  └──────────────► Gemini API
```

The backend coordinates the major system responsibilities:

* Authentication
* Authorization
* Project access
* Conversation retrieval
* Conversation persistence
* AI orchestration
* Gemini interaction
* Structured engineering information
* Security controls

The frontend provides the user-facing engineering workspace.

Firestore provides persistent project and conversation state.

Gemini provides generative reasoning.

Cloud Run provides containerized backend execution.

Firebase provides authentication and application infrastructure.

---

# Objectives

The primary objectives of NEXUS are:

### 1. Build an AI-Assisted Engineering Workspace

Provide developers with a dedicated environment for AI-supported engineering activities.

### 2. Maintain Persistent Project Context

Store project and conversation information so that important engineering context is not lost between sessions.

### 3. Enable Multi-Turn AI Interaction

Allow users to continue conversations while retaining previous context.

### 4. Provide Secure Multi-User Isolation

Ensure that project data belongs to and is accessible only by the appropriate authenticated user.

### 5. Integrate Google Cloud Services

Demonstrate practical use of Firebase, Firestore, Gemini, Secret Manager, and Cloud Run.

### 6. Maintain a Production-Oriented Architecture

Separate frontend, backend, authentication, persistence, AI, and secret management responsibilities.

---

# Key Features

## 1. Firebase Authentication

NEXUS uses Firebase Authentication for user identity.

Supported authentication methods include:

* Email/password
* Google Sign-In

The frontend uses Firebase Authentication to establish the user's identity.

A Firebase ID token is then used to authenticate requests to the backend.

---

## 2. Project Management

Authenticated users can create and interact with engineering projects.

Each project represents a persistent engineering context.

Conceptually:

```text
User
├── Project A
├── Project B
└── Project C
```

Each project belongs to its authenticated owner.

---

## 3. Multi-Turn Gemini Conversations

NEXUS supports contextual, multi-turn conversations with Gemini.

Instead of sending only the latest user message:

```text
User
  │
  ▼
Gemini
```

NEXUS reconstructs the conversation context:

```text
Current User Message
        +
Previous Messages
        +
Project Context
        │
        ▼
  AI Orchestrator
        │
        ▼
      Gemini
        │
        ▼
Context-Aware Response
```

This allows follow-up questions to remain connected to the previous discussion.

---

## 4. Persistent Conversations

Conversation messages are stored in Firestore.

This means conversation state is not dependent solely on the current browser session.

The application can retrieve previous messages and reconstruct the relevant context.

---

## 5. Planning

NEXUS provides a dedicated planning workflow for engineering-oriented planning activities.

The planning interface can be used to organize implementation-oriented information within a project context.

---

## 6. Engineering Decisions

NEXUS provides a dedicated decisions workflow for recording and reviewing engineering decisions.

This creates a structured location for technical reasoning rather than leaving important decisions buried inside conversations.

---

## 7. Project Audit

The audit workflow provides project-oriented visibility into engineering information and activity.

This creates the foundation for future traceability and engineering governance functionality.

---

## 8. User-Isolated Firestore Data

Project ownership is enforced using the authenticated Firebase UID.

The backend does not trust an arbitrary owner identifier supplied by the frontend.

---

## 9. Stateless Backend

The FastAPI backend is designed to run as a stateless container.

Persistent state is stored in Firestore rather than local container storage.

This makes the backend suitable for Cloud Run.

---

## 10. Secure Gemini API Access

Gemini API credentials are kept on the backend.

The intended production flow is:

```text
Google AI Studio
      │
      ▼
Gemini API Key
      │
      ▼
Google Cloud Secret Manager
      │
      ▼
Cloud Run
      │
      ▼
FastAPI Backend
      │
      ▼
Gemini API
```

The API key is never intentionally exposed to the frontend.

---

# System Architecture

The intended production architecture is:

```text
                         ┌──────────────────────┐
                         │        User          │
                         │       Browser        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Firebase Hosting   │
                         │                      │
                         │   Next.js Frontend   │
                         └──────────┬───────────┘
                                    │
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │      Cloud Run       │
                         │                      │
                         │   FastAPI Backend    │
                         └──────┬───────┬───────┘
                                │       │
                    ┌───────────┘       └────────────┐
                    │                                │
                    ▼                                ▼
          ┌──────────────────┐             ┌──────────────────┐
          │    Firestore     │             │    Gemini API     │
          │                  │             │                  │
          │ Projects         │             │ AI Generation    │
          │ Conversations    │             │                  │
          │ Messages         │             └──────────────────┘
          │ Planning         │
          │ Decisions        │
          │ Audit Data       │
          └──────────────────┘

                    ▲
                    │
          ┌─────────┴────────────┐
          │ Firebase             │
          │ Authentication       │
          │                      │
          │ Email / Password     │
          │ Google Sign-In       │
          └──────────────────────┘

                    ▲
                    │
          ┌──────────────────────┐
          │ Google Cloud         │
          │ Secret Manager       │
          │                      │
          │ Gemini API Key       │
          └──────────────────────┘
```

---

# Application Architecture

NEXUS follows a layered architecture:

```text
┌──────────────────────────────────────────────┐
│              Presentation Layer              │
│                                              │
│              Next.js / React                 │
└──────────────────────────┬───────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────┐
│                  API Layer                   │
│                                              │
│                    FastAPI                   │
└──────────────────────────┬───────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────┐
│            Authentication Layer              │
│                                              │
│          Firebase Token Verification         │
└──────────────────────────┬───────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────┐
│         Application / AI Layer               │
│                                              │
│       Orchestration + Engineering Logic     │
└───────────────────┬──────────────────┬───────┘
                    │                  │
                    ▼                  ▼
          ┌──────────────────┐  ┌──────────────────┐
          │ Persistence      │  │ AI Provider      │
          │ Layer            │  │                  │
          │                  │  │ Gemini           │
          │ Firestore        │  │                  │
          └──────────────────┘  └──────────────────┘
```

This separation prevents the frontend, database, AI provider, and authentication system from becoming tightly coupled.

---

# High-Level Data Flow

A typical AI interaction follows this flow:

```text
User Message
      │
      ▼
Next.js Frontend
      │
      ▼
FastAPI API
      │
      ▼
Verify Firebase ID Token
      │
      ▼
Verify Project Authorization
      │
      ▼
Retrieve Conversation History
      │
      ▼
AI Orchestrator
      │
      ▼
Gemini Client
      │
      ▼
Gemini API
      │
      ▼
Generated AI Response
      │
      ▼
Persist Response in Firestore
      │
      ▼
FastAPI
      │
      ▼
Next.js
      │
      ▼
User
```

---

# User Interaction Flow

## Authentication

```text
User
 │
 ▼
Login Page
 │
 ├── Email / Password
 │
 └── Google Sign-In
 │
 ▼
Firebase Authentication
 │
 ▼
Authenticated Session
 │
 ▼
NEXUS Workspace
```

## Project Creation

```text
Authenticated User
        │
        ▼
  Create Project
        │
        ▼
Frontend API Client
        │
        ▼
     FastAPI
        │
        ▼
Verified Firebase UID
        │
        ▼
    Firestore
        │
        ▼
 Project Created
```

## AI Conversation

```text
User Message
      │
      ▼
API Client
      │
      ▼
FastAPI
      │
      ▼
Authentication
      │
      ▼
Authorization
      │
      ▼
Conversation History
      │
      ▼
Gemini
      │
      ▼
AI Response
      │
      ▼
Firestore
      │
      ▼
Frontend
```

---

# Technology Stack

## Frontend

| Technology          | Purpose                   |
| ------------------- | ------------------------- |
| Next.js             | Web application framework |
| React               | UI framework              |
| TypeScript          | Static typing             |
| Firebase Client SDK | Authentication            |
| Vitest              | Frontend testing          |
| Firebase Hosting    | Frontend deployment       |

## Backend

| Technology             | Purpose                     |
| ---------------------- | --------------------------- |
| Python                 | Backend language            |
| FastAPI                | REST API framework          |
| Pydantic               | Validation and schemas      |
| Uvicorn                | ASGI server                 |
| Firebase Admin SDK     | Authentication verification |
| Google Cloud Firestore | Persistent storage          |
| Gemini API             | Generative AI               |
| Docker                 | Containerization            |
| Cloud Run              | Backend deployment          |

## Google Cloud and Firebase

| Service                     | Purpose                     |
| --------------------------- | --------------------------- |
| Firebase Authentication     | User identity               |
| Firestore                   | Persistent application data |
| Gemini API                  | AI generation               |
| Google Cloud Secret Manager | Secret storage              |
| Cloud Run                   | Backend execution           |
| Firebase Hosting            | Frontend hosting            |

---

# Google Cloud and Firebase Services

NEXUS is designed to demonstrate the use of multiple Google Cloud and Firebase services together.

## Firebase Authentication

Firebase Authentication provides:

* User registration
* Email/password login
* Google Sign-In
* Firebase ID tokens
* Authentication state

The backend verifies these tokens before granting access to protected resources.

---

## Firestore

Firestore provides persistent document-oriented storage.

NEXUS uses Firestore for:

* Projects
* Conversations
* Messages
* Planning information
* Engineering decisions
* Audit information

Firestore also provides the persistent state necessary for multi-turn conversations.

---

## Gemini API

Gemini is the generative AI engine behind the NEXUS engineering assistant.

The backend communicates with Gemini rather than exposing Gemini credentials to the browser.

Gemini receives the relevant conversation context and generates the AI response.

---

## Google Cloud Secret Manager

Secret Manager provides a secure location for sensitive backend credentials.

The intended flow is:

```text
Secret Manager
      │
      ▼
   Cloud Run
      │
      ▼
FastAPI Backend
      │
      ▼
  Gemini API
```

The Gemini API key should be stored as a Secret Manager secret rather than committed to source control.

---

## Cloud Run

Cloud Run hosts the containerized FastAPI backend.

The backend:

* Runs in a container
* Listens on port `8080`
* Remains stateless
* Uses Firestore for persistence
* Accesses Gemini through the backend

---

## Firebase Hosting

Firebase Hosting is used as the intended deployment platform for the Next.js frontend.

The production architecture therefore separates:

```text
Firebase Hosting
      │
      ▼
Next.js Frontend
      │
      ▼
Cloud Run
      │
      ▼
FastAPI Backend
```

---

# Authentication

NEXUS uses Firebase Authentication for user identity.

## Authentication Process

1. User submits credentials.
2. Firebase Authentication processes the credentials.
3. Firebase establishes the authenticated session.
4. The frontend obtains a Firebase ID token.
5. The API client attaches the token to backend requests.
6. The backend verifies the token.
7. The backend obtains the authenticated UID.
8. The request continues only if authentication succeeds.

---

## Google Sign-In

Google Sign-In is implemented using Firebase Authentication's Google provider.

The flow is:

```text
User
  │
  ▼
Google Sign-In
  │
  ▼
Firebase Authentication
  │
  ▼
Firebase User
  │
  ▼
Firebase ID Token
  │
  ▼
NEXUS Backend
```

---

# Authorization and User Isolation

Authentication alone is not sufficient for a multi-user application.

NEXUS also performs server-side authorization.

The backend uses the UID from the verified Firebase token to determine whether the user owns a project.

Conceptually:

```python
authenticated_uid = verified_firebase_user.uid

project = get_project(project_id)

if project.owner_uid != authenticated_uid:
    reject_request()
```

This prevents the client from simply changing an identifier to access another user's project.

---

## Example

Suppose:

```text
User A
├── Project A1
└── Project A2

User B
├── Project B1
└── Project B2
```

User A should be able to access:

```text
Project A1
Project A2
```

but not:

```text
Project B1
Project B2
```

The backend enforces this boundary.

---

# Multi-Turn Gemini Interaction

A core NEXUS capability is persistent multi-turn interaction with Gemini.

A simple chatbot implementation might send:

```text
"How should I deploy this?"
```

without knowing what the user was discussing previously.

NEXUS instead retrieves the conversation history.

For example:

```text
User:
"We are building a FastAPI application."

Assistant:
"FastAPI is appropriate for the backend..."

User:
"We also need Firebase authentication."

Assistant:
"You can verify Firebase ID tokens..."

User:
"How should deployment work?"
```

The final question can be processed with the previous messages as context.

The system therefore behaves as:

```text
Current Message
      +
Previous Messages
      +
Project Context
      │
      ▼
AI Orchestrator
      │
      ▼
Gemini
      │
      ▼
Context-Aware Response
```

---

# Conversation Persistence

Conversation history is persisted in Firestore.

A conceptual representation is:

```text
Project
└── Conversation
    ├── Message 1
    ├── Message 2
    ├── Message 3
    └── Message N
```

When a user continues a conversation:

```text
New Message
     │
     ▼
Load Existing Conversation
     │
     ▼
Reconstruct History
     │
     ▼
Send Context to Gemini
     │
     ▼
Persist New Response
```

This allows the conversation to survive browser reloads and backend instance changes.

---

# Engineering Intelligence Layer

NEXUS is designed around the concept that AI should operate over engineering context.

The architecture separates responsibilities:

```text
Gemini
  │
  ▼
Reasoning / Generation
  │
  ▼
AI Orchestrator
  │
  ▼
Engineering Logic
  │
  ▼
Firestore
  │
  ▼
Persistent State
  │
  ▼
NEXUS Project
```

This distinction is important.

Gemini is not treated as the application's database.

Firestore is responsible for persistent state.

The FastAPI backend coordinates the two.

---

# Frontend Architecture

The frontend is implemented using Next.js, React, and TypeScript.

A simplified structure is:

```text
frontend/
├── app/
│   ├── login/
│   ├── projects/
│   │   └── [id]/
│   │       ├── audit/
│   │       ├── decisions/
│   │       ├── planning/
│   │       └── ...
│   └── ...
│
├── lib/
│   ├── api-client.ts
│   ├── auth-context.tsx
│   ├── firebase.ts
│   └── contracts/
│
├── __tests__/
├── package.json
└── ...
```

The frontend is responsible for:

* Rendering the application
* Authentication UI
* Firebase client integration
* Managing authenticated state
* Calling backend APIs
* Displaying project information
* Displaying AI responses
* Providing engineering workflows

The frontend is not responsible for:

* Gemini API credentials
* Server-side authorization
* Firestore ownership enforcement
* Backend secret management

---

# Backend Architecture

The backend is implemented using FastAPI and Python.

A simplified structure is:

```text
backend/
├── agents/
│   ├── gemini_client.py
│   └── orchestrator.py
│
├── api/
│   ├── chat.py
│   ├── projects.py
│   └── ...
│
├── auth/
│   ├── dependencies.py
│   └── token_verifier.py
│
├── firestore/
│   ├── conversation_repo.py
│   ├── project_repo.py
│   └── ...
│
├── config.py
└── main.py
```

## API Layer

The API layer handles HTTP requests and responses.

Examples include:

* Project creation
* Project retrieval
* Project updates
* Conversation interaction
* Project-specific engineering operations

## Authentication Layer

The authentication layer verifies Firebase ID tokens.

It provides the rest of the application with the authenticated user's identity.

## Repository Layer

Repositories abstract Firestore access.

For example:

```text
API
 │
 ▼
Project Repository
 │
 ▼
Firestore
```

and:

```text
AI Orchestrator
 │
 ▼
Conversation Repository
 │
 ▼
Firestore
```

This prevents application logic from being tightly coupled to raw Firestore operations.

## AI Layer

The AI layer is separated into:

```text
AI Orchestrator
      │
      ▼
Gemini Client
      │
      ▼
Gemini API
```

The orchestrator is responsible for application-level AI flow.

The Gemini client is responsible for communicating with the model.

---

# Project Structure

The repository follows a monorepo structure:

```text
Nexus/
├── backend/
│   ├── agents/
│   │   ├── gemini_client.py
│   │   └── orchestrator.py
│   ├── api/
│   │   ├── chat.py
│   │   ├── projects.py
│   │   └── ...
│   ├── auth/
│   │   ├── dependencies.py
│   │   └── token_verifier.py
│   ├── firestore/
│   │   ├── conversation_repo.py
│   │   ├── project_repo.py
│   │   └── ...
│   ├── config.py
│   └── main.py
│
├── frontend/
│   ├── app/
│   │   ├── login/
│   │   ├── projects/
│   │   └── ...
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── auth-context.tsx
│   │   ├── firebase.ts
│   │   └── contracts/
│   ├── __tests__/
│   ├── package.json
│   └── ...
│
├── scripts/
│   └── deploy_backend.sh
│
├── tests/
│   └── backend/
│
├── Dockerfile
├── .dockerignore
├── .gitignore
├── README.md
└── ...
```

---

# Data Model

NEXUS uses Firestore as its persistent application database.

A conceptual data model is:

```text
User
└── Projects
    ├── Project Metadata
    ├── Conversations
    │   └── Messages
    ├── Planning
    ├── Decisions
    └── Audit Information
```

Each project contains an ownership boundary associated with the authenticated Firebase UID.

---

# API Architecture

The frontend communicates with the FastAPI backend through a dedicated API client.

The API client is responsible for:

* Constructing HTTP requests
* Attaching authentication tokens
* Handling API responses
* Using typed contracts
* Centralizing backend communication

A protected request conceptually looks like:

```http
POST /api/projects/{project_id}/chat
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

The backend then performs:

```text
Request
   │
   ▼
Token Verification
   │
   ▼
UID Extraction
   │
   ▼
Project Authorization
   │
   ▼
Conversation Retrieval
   │
   ▼
Gemini Interaction
   │
   ▼
Persistence
   │
   ▼
Response
```

---

# Security Architecture

Security is implemented across multiple layers.

## Client

The frontend handles authentication but is not trusted for authorization.

## Backend

The backend verifies Firebase tokens and enforces resource ownership.

## Database

Firestore stores persistent project and conversation information.

## Secrets

Sensitive backend credentials are intended to be stored in Google Cloud Secret Manager.

## AI

The Gemini API key remains server-side.

The overall security boundary is:

```text
Browser
  │
  │ Firebase ID Token
  ▼
FastAPI Backend
  │
  ├── Verify Identity
  │
  ├── Verify Authorization
  │
  ├── Access Firestore
  │
  └── Access Gemini
          │
          ▼
     Secret Manager
```

---

# Environment Configuration

Different environments require different configuration.

## Frontend

The frontend uses:

```text
NEXT_PUBLIC_API_BASE_URL
```

to identify the backend API.

For local development:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

For production:

```text
NEXT_PUBLIC_API_BASE_URL=https://YOUR-CLOUD-RUN-SERVICE.run.app
```

The exact production value depends on the deployed Cloud Run service.

---

## Backend

The backend requires configuration for:

* Firebase
* Firestore
* Gemini
* CORS
* Runtime environment

Sensitive credentials should not be committed to source control.

---

# Local Development

## Prerequisites

Install:

* Node.js
* npm
* Python 3.11+
* Git
* Firebase CLI
* Google Cloud CLI

You will also need a configured Firebase / Google Cloud project for full-stack functionality.

---

# Testing

NEXUS uses automated testing for both frontend and backend components.

## Frontend Type Checking

```bash
cd frontend
npm run type-check
```

This validates TypeScript without creating a production deployment.

## Frontend Tests

```bash
cd frontend
npm run test
```

The frontend tests cover areas including:

* Authentication
* Google Sign-In
* Authentication state
* API client behavior
* Components
* Application flows

## Frontend Production Build

```bash
cd frontend
npm run build
```

This validates the Next.js production build.

## Backend Tests

From the repository root:

```bash
PYTHONPATH=. pytest tests/backend/ -v
```

The backend test suite validates areas including:

* Authentication
* API routes
* Project access
* Repository behavior
* AI orchestration
* Authorization behavior

---

# Production Architecture

The intended production deployment is:

```text
                  ┌────────────────────┐
                  │       User         │
                  │      Browser       │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │ Firebase Hosting   │
                  │   Next.js App      │
                  └─────────┬──────────┘
                            │
                          HTTPS
                            │
                            ▼
                  ┌────────────────────┐
                  │     Cloud Run      │
                  │   FastAPI API      │
                  └──────┬─────┬───────┘
                         │     │
                 ┌───────┘     └────────┐
                 ▼                       ▼
        ┌────────────────┐      ┌────────────────┐
        │   Firestore    │      │   Gemini API   │
        └────────────────┘      └───────┬────────┘
                                        │
                                        ▼
                               ┌────────────────┐
                               │ Secret Manager │
                               └────────────────┘
```

The frontend and backend are independently deployed components while sharing the same Google Cloud and Firebase project infrastructure.

---

# Firebase Hosting Deployment

The frontend is intended to be deployed through Firebase Hosting.

The deployment flow is:

```text
Developer
    │
    ▼
GitHub
    │
    ▼
Firebase Hosting
    │
    ▼
Next.js Frontend
```

The frontend then communicates with the Cloud Run backend.

## Frontend Backend URL

The frontend must know where the backend is running.

Configure:

```text
NEXT_PUBLIC_API_BASE_URL
```

with the deployed Cloud Run URL.

Example:

```text
NEXT_PUBLIC_API_BASE_URL=https://nexus-backend-xxxxx.run.app
```

The backend URL is public information and does not contain the Gemini API key.

---

# Cloud Run Deployment

The FastAPI backend is packaged as a Docker container.

The repository includes:

```text
Dockerfile
```

and:

```text
scripts/deploy_backend.sh
```

The deployment process is designed to configure:

* Cloud Run
* Container image
* Runtime environment
* Secret Manager integration
* CORS
* Challenge label

The backend container listens on:

```text
8080
```

## Cloud Run Runtime

The Cloud Run service is designed to be stateless.

Persistent state is not stored on the local container filesystem.

Instead:

```text
Cloud Run
├── Authentication → Firebase
├── Persistence    → Firestore
├── AI             → Gemini
└── Secrets        → Secret Manager
```

---

# Secret Manager Configuration

The Gemini API key is a sensitive credential.

The intended production configuration is:

```text
Google AI Studio
      │
      ▼
Gemini API Key
      │
      ▼
Google Cloud Secret Manager
      │
      ▼
Cloud Run Secret Injection
      │
      ▼
FastAPI
      │
      ▼
Gemini API
```

A Secret Manager secret can be named:

```text
gemini-api-key
```

The Cloud Run runtime service account must have permission to access the secret.

The required permission is:

```text
roles/secretmanager.secretAccessor
```

The Gemini API key should never be placed in:

```text
frontend/
.env.local
NEXT_PUBLIC_*
GitHub
README.md
source code
browser storage
```

---

# Firebase Authentication Configuration

Firebase Authentication should be enabled for the project.

The authentication providers required by NEXUS include:

* Email/password
* Google

The Firebase project must also have the appropriate authorized domains configured for the deployed application.

For local development, this typically includes:

```text
localhost
```

For production, the deployed Firebase Hosting domain must be authorized.

---

# Firestore Configuration

Firestore provides persistent storage for the application.

The backend uses Firebase Admin credentials to interact with Firestore.

The Cloud Run runtime service account must have the required Firestore / Datastore permissions.

The application should treat Firestore as the source of truth for persistent project and conversation state.

---

# CORS Configuration

The frontend and backend are separate origins.

Therefore, the backend must explicitly allow requests from the frontend.

Development:

```text
http://localhost:3000
```

Production:

```text
https://YOUR-FIREBASE-HOSTING-DOMAIN
```

The production backend should **not** use:

```text
*
```

as its CORS origin.

Instead, allowed origins should be supplied through configuration.

This allows the same application code to work in different environments.

---

# Challenge Requirements

NEXUS is designed around the required services for the GenAI APAC Academy Cohort 3 project.

## User Authentication via Firebase

Implemented through:

```text
Firebase Authentication
```

Authentication supports:

* Email/password
* Google Sign-In

Firebase ID tokens are verified by the backend.

---

## Multi-Turn Interaction with Gemini API

Implemented through:

```text
Conversation Repository
        │
        ▼
AI Orchestrator
        │
        ▼
Gemini Client
        │
        ▼
Gemini API
```

Conversation history is retrieved from Firestore and supplied to Gemini as contextual history.

---

## User-Isolated Firestore Document Storage

Projects are associated with the authenticated Firebase UID.

The backend validates ownership before accessing protected project resources.

This provides server-side user isolation.

---

## Secure API Key Retrieval via Google Cloud Secret Manager

The intended production architecture stores the Gemini API key in Google Cloud Secret Manager.

Cloud Run retrieves the secret through its runtime configuration.

The API key is therefore kept outside the frontend.

---

# Challenge Verification

The Cloud Run service is configured with the required challenge label:

```text
dev-tutorial=cloud-run-ai-challenge
```

The label can be verified with:

```bash
gcloud run services describe YOUR_SERVICE_NAME \
  --region=YOUR_REGION \
  --project=YOUR_PROJECT_ID \
  --format="yaml(metadata.labels)"
```

The expected output should contain:

```yaml
dev-tutorial: cloud-run-ai-challenge
```

---

# Engineering Decisions

## Why FastAPI?

FastAPI was selected because it provides:

* Strong typing
* Pydantic validation
* Clear API structure
* Python ecosystem compatibility
* Straightforward Docker deployment
* Good support for asynchronous workloads

It also integrates naturally with the Python-based Gemini client and Firebase Admin SDK.

---

## Why Next.js?

Next.js provides:

* React-based application development
* File-based routing
* TypeScript support
* Production build tooling
* Straightforward Firebase Hosting deployment

The project workspace maps naturally onto Next.js application routes.

---

## Why Firestore?

Firestore provides a managed, document-oriented database that integrates naturally with Firebase.

It is suitable for NEXUS because the application stores hierarchical project information such as:

```text
Projects
├── Conversations
│   └── Messages
├── Planning
├── Decisions
└── Audit Information
```

Firestore also provides the persistent state required for multi-turn conversations.

---

## Why Firebase Authentication?

Firebase Authentication provides:

* Managed identity
* Google authentication
* Email/password authentication
* Firebase ID tokens
* Integration with other Firebase services

It also allows the application to use a consistent identity boundary across the frontend and backend.

---

## Why Cloud Run?

Cloud Run was selected because it provides:

* Containerized execution
* Automatic infrastructure management
* Stateless service deployment
* Horizontal scaling
* HTTPS endpoints
* Integration with Google Cloud services

The NEXUS backend can therefore run without managing virtual machines or traditional server infrastructure.

---

## Why Firebase Hosting?

Firebase Hosting provides a natural deployment target for a Firebase-centric application.

The architecture becomes:

```text
Firebase Authentication
          │
          ├──────────────┐
          ▼              │
      Firestore          │
                         │
Firebase Hosting         │
      │                  │
      ▼                  │
Next.js Frontend         │
      │                  │
      ▼                  │
Cloud Run                │
      │                  │
      ▼                  │
FastAPI Backend          │
      │                  │
      ▼                  │
Gemini API ◄─────────────┘
      │
      ▼
Secret Manager
```

This keeps the frontend and core application infrastructure closely integrated with the Google Cloud / Firebase ecosystem used by the project.

---

# Why NEXUS Is Not Just a Chatbot

A conventional chatbot can be represented as:

```text
User
  │
  ▼
LLM
  │
  ▼
Response
```

NEXUS is fundamentally different:

```text
User
  │
  ▼
Next.js UI
  │
  ▼
FastAPI
  │
  ▼
Authentication
  │
  ├───────────┐
  ▼           ▼
Firestore   Gemini
  │           │
  └─────┬─────┘
        ▼
Engineering Intelligence
```

The AI model is one component within a larger application architecture.

The application itself provides:

* Identity
* Authorization
* Persistence
* Project context
* Conversation history
* Structured workflows
* Engineering artifacts
* Auditability
* Security controls

This is what allows NEXUS to function as an engineering intelligence platform rather than simply an AI chat interface.

---

# Failure Handling

NEXUS separates failures by system layer.

## Authentication Failure

Invalid or expired Firebase tokens result in an authentication error.

## Authorization Failure

A user attempting to access another user's project is rejected.

## Project Not Found

Requests referencing nonexistent projects are handled as application-level errors rather than being silently ignored.

## Gemini Failure

Failures from the external AI provider are separated from internal application failures.

## Firestore Failure

Persistence errors are isolated within the repository layer so they do not become indistinguishable from AI or API failures.

---

# Testing Strategy

NEXUS uses multiple levels of testing.

## Static Validation

TypeScript validation:

```bash
npm run type-check
```

This catches frontend type errors before deployment.

---

## Frontend Tests

The frontend test suite validates:

* Authentication behavior
* Google Sign-In
* Authentication state
* API client behavior
* Components
* Application flows

---

## Backend Tests

The backend test suite validates:

* Authentication
* Authorization
* Project access
* Repository behavior
* API behavior
* AI orchestration

---

## Production Build

The frontend is also tested using:

```bash
npm run build
```

This ensures the application can successfully compile as a production Next.js application.

---

## Security-Oriented Scenarios

Important security scenarios include:

### Valid Authentication

```text
Valid Firebase Token
        │
        ▼
Request Accepted
```

### Invalid Authentication

```text
Invalid Firebase Token
        │
        ▼
Request Rejected
```

### Unauthorized Project Access

```text
User A
  │
  ▼
Attempts User B's Project
  │
  ▼
Backend Ownership Check
  │
  ▼
Request Rejected
```

### Persistent Conversation

```text
Message
  │
  ▼
Firestore
  │
  ▼
Page Reload
  │
  ▼
Conversation Retrieved
```

---

# Limitations

The current implementation provides the foundation for a broader engineering intelligence platform, but several capabilities can be expanded.

Current limitations include:

* Project context is primarily represented through application-managed data.
* Repository-level code analysis is not yet a complete feature.
* Advanced semantic retrieval is not yet implemented.
* Automated engineering traceability can be expanded.
* AI output evaluation can be made more systematic.
* Multi-model comparison is not currently a primary workflow.

These limitations are intentional opportunities for future development rather than architectural blockers.

---

# Future Improvements

## 1. Repository Intelligence

Allow users to connect a source repository and allow NEXUS to understand:

* File structure
* Source code
* Dependencies
* Configuration
* Tests
* Documentation

---

## 2. Retrieval-Augmented Generation

Introduce a retrieval layer:

```text
Project Documents
       │
       ▼
Document Processing
       │
       ▼
Embeddings
       │
       ▼
Vector Search
       │
       ▼
Relevant Context
       │
       ▼
Gemini
```

This would allow Gemini to answer questions grounded in project-specific documentation.

---

## 3. Engineering Traceability

A future NEXUS version could connect:

```text
Requirements
      │
      ▼
Architecture
      │
      ▼
Components
      │
      ▼
Implementation
      │
      ▼
Tests
      │
      ▼
Deployment
```

This would provide end-to-end engineering traceability.

---

## 4. Architecture Graph

NEXUS could construct an interactive engineering graph connecting:

* Requirements
* Services
* Components
* APIs
* Databases
* Decisions
* Tests
* Deployments

---

## 5. Automated Decision Extraction

The AI could identify technical decisions from conversations.

For example:

```text
Conversation
      │
      ▼
Decision Detection
      │
      ▼
Decision Record
 ┌───────────────┐
 │ Decision      │
 │ Rationale     │
 │ Alternatives  │
 │ Trade-offs    │
 └───────────────┘
```

---

## 6. AI Engineering Audit

Future versions could automatically detect:

* Missing requirements
* Architecture inconsistencies
* Security risks
* Missing tests
* Technical debt
* Undocumented decisions
* Dependency risks

---

## 7. Model Evaluation

NEXUS could evaluate different AI models based on:

* Response quality
* Engineering correctness
* Latency
* Cost
* Context utilization
* Hallucination rate

---

# Development Workflow

The recommended development cycle is:

```text
1. Implement change
       │
       ▼
2. Run type checking
       │
       ▼
3. Run frontend tests
       │
       ▼
4. Run backend tests
       │
       ▼
5. Run production build
       │
       ▼
6. Review git diff
       │
       ▼
7. Commit changes
       │
       ▼
8. Push to GitHub
       │
       ▼
9. Deploy
       │
       ▼
10. Perform end-to-end validation
```

Useful commands:

Repository status:

```bash
git status
```

Review changes:

```bash
git diff
```

Frontend validation:

```bash
cd frontend

npm run type-check
npm run test
npm run build
```

Backend validation:

```bash
cd ..

PYTHONPATH=. pytest tests/backend/ -v
```

---

# Project Status

## Implemented

* [x] Next.js frontend
* [x] React UI
* [x] TypeScript
* [x] Firebase Authentication
* [x] Email/password authentication
* [x] Google Sign-In
* [x] Firebase ID token handling
* [x] FastAPI backend
* [x] Firebase Admin authentication verification
* [x] User-scoped projects
* [x] Server-side project ownership checks
* [x] Firestore persistence
* [x] Multi-turn Gemini orchestration
* [x] Persistent conversation history
* [x] Planning workflow
* [x] Decisions workflow
* [x] Audit workflow
* [x] Dockerized backend
* [x] Cloud Run deployment configuration
* [x] Secret Manager integration architecture
* [x] Configurable CORS
* [x] Frontend automated tests
* [x] Backend automated tests
* [x] Next.js production build
* [x] Firebase Hosting deployment architecture
* [x] Cloud Run deployment architecture
* [x] Challenge verification label

---

# Design Philosophy

NEXUS is built around a simple principle:

> AI should operate as an engineering intelligence layer over persistent project context, rather than as an isolated chatbot.

Gemini provides:

* Reasoning
* Generation
* Natural-language interaction

The application provides:

* Identity
* Authorization
* Persistence
* Project Context
* Engineering Workflows
* Traceability
* Security

Firestore provides:

* Persistent State

FastAPI provides:

* Orchestration
* API Access
* Authorization
* Integration

Next.js provides:

* User Interface

Together, these components form the NEXUS engineering intelligence platform.

---

# License

This project was developed as part of the **GenAI APAC Academy Cohort 3** project.

Unless otherwise specified, the source code is provided for educational, demonstration, and portfolio purposes.

---

# Author

**Partha**

Computer Science / Data Science Student

**NEXUS — AI Engineering Intelligence Platform**

---

# NEXUS at a Glance

```text
┌──────────────────────────────────────────────────────────────┐
│                           NEXUS                              │
│                                                              │
│             AI Engineering Intelligence Platform             │
│                                                              │
│  ┌──────────────┐       HTTPS       ┌──────────────┐        │
│  │   Firebase   │ ────────────────► │   Cloud Run  │        │
│  │   Hosting    │                   │   FastAPI    │        │
│  │   Next.js    │                   │   Backend    │        │
│  └──────────────┘                   └──────┬───────┘        │
│                                            │                │
│                          ┌─────────────────┼──────────────┐ │
│                          │                 │              │ │
│                          ▼                 ▼              ▼ │
│                   ┌────────────┐   ┌────────────┐  ┌───────────┐
│                   │ Firebase   │   │ Firestore  │  │  Gemini   │
│                   │    Auth    │   │            │  │    API    │
│                   └────────────┘   └────────────┘  └─────┬─────┘
│                                                           │
│                                                           ▼
│                                                   ┌──────────────┐
│                                                   │    Secret    │
│                                                   │    Manager   │
│                                                   └──────────────┘
│                                                              │
│                    Google Cloud / Firebase                    │
└──────────────────────────────────────────────────────────────┘
```

NEXUS combines authenticated users, persistent engineering context, multi-turn Gemini interaction, structured engineering workflows, and cloud-native infrastructure into a unified engineering intelligence platform.
