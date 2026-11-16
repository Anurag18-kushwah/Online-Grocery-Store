# 1. Project Overview
## Introduction
GrocerAI is a browser-based grocery shopping application combining standard e-commerce workflows with grocery-oriented decision support. It helps shoppers discover products, compare catalogue attributes, plan a basket, explore recipes, and review possible substitutions.

## Problem statement
Online grocery shoppers may need to compare price, pack size, dietary labels, allergens, discounts, availability, and delivery estimates across many items. Budget planning and selecting replacements can also be time-consuming. GrocerAI brings these tasks into one application.

## Objectives
- Account registration, login, profile, and preferences.
- Product catalogue, search, sorting, and combinable filters.
- Guest and authenticated cart, cart merge, wishlist, checkout, and orders.
- Recommendations, substitutions, recipes, meal planning, and basket optimisation.
- Admin catalogue, stock, category, order, and dashboard operations.
- Optional language assistance with deterministic fallback.

## Scope
Included: React web client, Express API, data models/store, shopping workflows, admin functions, deterministic recommendation/optimisation logic, recipe support, optional LLM adapter.
Not established as live: real payment processing, courier tracking, external price comparison, supplier inventory synchronisation, or a trained ML prediction service.

## Actors
Guest shopper; registered shopper; administrator; optional external LLM provider.

## Key features
Product filters include query, price, categories, brands, diet, allergens, stock, delivery, discount, pack size, unit price, rating, shelf life, and available nutrition fields. The seed README describes 56 products, 8 categories, demo users/order history, and 42 recipes; verify against the final seed data before submission.
