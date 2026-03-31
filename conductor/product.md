# Initial Concept

A full-stack marketplace for buying and selling cash receipts — with OCR scanning, fraud detection, Stripe Connect payments, and React Native mobile app.

# Product Guide

## Overview
Cheetah is a high-performance marketplace enabling users to monetize their daily cash receipts and providing buyers with a secure platform to purchase receipts for returns and other legitimate uses. The application integrates advanced OCR technology and a custom fraud detection engine to ensure data accuracy and marketplace integrity.

## Target Audience
The primary audience consists of individual sellers and buyers. Sellers aim to monetize their daily receipts, while buyers seek specific receipts for customer service returns. As the marketplace scales, the audience may expand to include bulk collectors, coupon hunters, and data analysts interested in receipt-level consumer data.

## Key Goals
1.  **Application Robustness**: Finalize all existing features and ensure a production-ready state by removing to-dos, debugging logs, and commented-out code.
2.  **Marketplace Integrity**: Strengthen the fraud detection engine to ensure high confidence in all listed receipts.
3.  **User Experience (UX)**: Optimize the end-to-end flow for both web and mobile users, from OCR scanning to secure payment and dispute resolution.

## Core Features
1.  **OCR Pipeline**: GPT-4o Vision-powered scanning of store names, dates, items, and UPCs with an interactive fallback for manual validation.
2.  **Fraud Scoring**: A custom behavior-based engine that evaluates duplicate hashes, UPC validation, and seller reputation.
3.  **Stripe Connect Integration**: A secure payment system with a 90/10 payout split favoring sellers, supporting automated marketplace commissions.
4.  **Dispute Resolution**: A comprehensive UI and backend system for managing buyer disputes and seller responses with admin mediation.
5.  **Mobile App**: A dedicated React Native (Expo) application for on-the-go receipt scanning and marketplace browsing.

## Value Proposition
Cheetah differentiates itself through its direct peer-to-peer marketplace model, high seller payout percentages, and a robust security layer that protects buyers through automated fraud detection and fair dispute rules.
