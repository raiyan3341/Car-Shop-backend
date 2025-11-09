# ⚙️ Car Rental Backend (API)

This repository contains the **Backend API** for a modern, full-stack **Car Rental Application**.  
It is built with **Node.js**, **Express.js**, and **MongoDB**, providing robust data management and secure endpoints to serve the frontend efficiently.

---

## ✨ Key Features

- 🛡️ **Secure Authentication (JWT)**  
  Implements **JSON Web Tokens (JWT)** and custom Express middleware (`verifyToken`) to validate client requests and protect sensitive data.

- 🔗 **Scalable Database Architecture**  
  Uses **MongoDB Atlas** via **Mongoose ORM** to manage users, car listings, and booking records efficiently.

- 🚦 **Protected Routes**  
  Critical endpoints like `/cars/add` and `/bookings` are accessible only to authenticated users via the JWT-based middleware.

- 🔍 **Advanced Querying**  
  Supports flexible searching (via **Regex**), result limiting, and user-specific filtering (e.g., fetching listings by email).

- 📅 **Automated Transaction Management**  
  Automatically updates a car’s availability status when booked or canceled.

- 🐛 **Robust Error Handling**  
  Includes server-side input validation and consistent JSON responses with clear HTTP status codes.

---

## 💻 Tech Stack

| Category | Technology |
|-----------|-------------|
| **Runtime Environment** | Node.js |
| **Web Framework** | Express.js |
| **Database** | MongoDB (via Mongoose) |
| **Authentication** | JWT (`jsonwebtoken`) |
| **Environment Management** | Dotenv |
| **CORS Handling** | CORS middleware |

---

## ⚙️ Installation & Setup Guide

Follow these steps to run the backend server locally.

### 🧩 Prerequisites
- Node.js (LTS version recommended)
- npm or yarn
- MongoDB Atlas account (or local MongoDB setup)

---

|   Method   | Endpoint           | Description                                               | Protection       |
| :--------: | :----------------- | :-------------------------------------------------------- | :--------------- |
|  **POST**  | `/auth/jwt`        | Issues a new JWT upon successful login.                   | Public           |
|   **GET**  | `/cars`            | Fetches all cars (supports search & limit queries).       | Public           |
|  **POST**  | `/cars/add`        | Adds a new car listing.                                   | 🔒 Private (JWT) |
|  **PATCH** | `/cars/:id`        | Updates a car’s details.                                  | 🔒 Private (JWT) |
| **DELETE** | `/cars/:id`        | Deletes a car listing.                                    | 🔒 Private (JWT) |
|   **GET**  | `/bookings/:email` | Fetches bookings for a specific user.                     | 🔒 Private (JWT) |
|  **POST**  | `/book`            | Creates a booking & updates the car’s status to “Booked.” | 🔒 Private (JWT) |
| **DELETE** | `/bookings/:id`    | Cancels a booking & restores car status to “Available.”   | 🔒 Private (JWT) |


-👤 Developer

- [MD RAYAN BIN RAFIN]
-🔗 GitHub Profile :

-💼 LinkedIn Profile :
