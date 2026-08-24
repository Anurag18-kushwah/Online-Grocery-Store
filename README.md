# Online Grocery Store – Full Stack E-Commerce Platform with Smart Recommendations

## Project Description

The **Online Grocery Store** is a full-stack web-based e-commerce application designed to provide customers with a convenient platform for purchasing grocery products online.

The system allows customers to register and login, browse and search grocery products, view product details, manage their shopping cart, place orders, track orders, and view their order history.

The application also includes a **Smart Product Recommendation System** that provides personalized product suggestions based on customer activity, previous orders, product categories, and shopping behavior.

The administrator can manage products, inventory, users, and customer orders through an administrative interface.

The project is developed using Software Engineering principles including requirements analysis, system design, implementation, testing, documentation, version control, and project management.

---

# Team Members

| Role                              | Responsibility                                   | Member          |
| --------------------------------- | ------------------------------------------------ | --------------- |
| Project Manager                   | Project planning, coordination and documentation | Anurag          |
| Backend Developer                 | Backend logic, APIs and database integration     | Anush Kumar     |
| Frontend Developer                | User interface and frontend development          | Aryan Kanaujiya |
| Tester & Recommendation Developer | Testing, bug reporting and recommendation system | Ayan Khan       |

---

# Technologies Used

## Frontend

* HTML
* CSS
* JavaScript
* React.js

## Backend

* Node.js
* Express.js
* REST APIs

## Database

* MySQL

## Authentication & Security

* JWT Authentication
* Password Hashing
* Role-Based Access Control

## Development & Collaboration

* Git
* GitHub
* Visual Studio Code
* Postman

## Recommendation System

* User purchase history
* Product browsing activity
* Product categories
* Similar products
* Frequently bought products
* Personalized recommendations

---

# Main Features

## Customer Features

* User Registration
* User Login
* Secure Authentication
* Browse Grocery Products
* Search Products
* Filter Products by Category
* Sort Products by Price and Relevance
* View Product Details
* Add Products to Cart
* Update Cart Quantity
* Remove Products from Cart
* Manage Delivery Address
* Place Orders
* View Order History
* Track Orders
* Personalized Product Recommendations
* Related Product Suggestions
* Frequently Bought Together Products

---

## Smart Recommendation Features

The Online Grocery Store provides a smart recommendation system to improve the customer's shopping experience.

The recommendation system can suggest products based on:

### 1. Purchase History

Products are recommended based on items purchased by the customer previously.

### 2. Browsing History

Products related to the customer's recently viewed products can be recommended.

### 3. Category-Based Recommendations

If a customer frequently purchases products from a particular category, more products from that category can be recommended.

### 4. Similar Products

The system can recommend products that are similar to the product currently being viewed.

### 5. Frequently Bought Together

The system can recommend products that are commonly purchased together.

For example:

```text
Customer purchases:
Milk + Bread

Recommendation:
Eggs
Butter
Jam
```

### 6. Personalized Recommendations

The system can combine different user activities to provide personalized grocery suggestions.

---

# Admin Features

The administrator can:

* Admin Login
* Add Products
* Update Products
* Delete Products
* Manage Product Categories
* Manage Product Prices
* Manage Product Inventory
* View Customers
* View Orders
* Update Order Status
* Manage Products
* Monitor Stock Availability

---

# Project Structure

```text
online-grocery-store/
│
├── README.md
│
├── docs/
│   ├── SRS/
│   └── UML/
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── context/
│       └── App.jsx
│
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── config/
│   ├── services/
│   └── server.js
│
├── recommendation/
│   ├── recommendation.js
│   └── data/
│
├── test/
│
└── .gitignore
```

---

# Directory Description

| Directory/File             | Description                           |
| -------------------------- | ------------------------------------- |
| `README.md`                | Project documentation                 |
| `docs/`                    | Software Engineering documentation    |
| `docs/SRS/`                | Software Requirements Specification   |
| `docs/UML/`                | UML diagrams                          |
| `frontend/`                | React frontend application            |
| `frontend/src/components/` | Reusable UI components                |
| `frontend/src/pages/`      | Application pages                     |
| `frontend/src/services/`   | API service functions                 |
| `frontend/src/context/`    | Global application state              |
| `backend/`                 | Node.js and Express backend           |
| `backend/controllers/`     | Application business logic            |
| `backend/models/`          | Database models                       |
| `backend/routes/`          | REST API routes                       |
| `backend/middleware/`      | Authentication and middleware         |
| `backend/config/`          | Configuration and database connection |
| `backend/services/`        | Backend services                      |
| `recommendation/`          | Smart recommendation logic            |
| `test/`                    | Test cases and testing files          |
| `.gitignore`               | Files ignored by Git                  |

---

# Software Engineering Tools

Software Engineering involves several activities such as requirements analysis, system design, coding, testing, version control, documentation, and project management.

Different tools are used for different activities.

| Activity                   | Example Tools           |
| -------------------------- | ----------------------- |
| Requirements Documentation | MS Word, Google Docs    |
| UML Design                 | Draw.io, StarUML        |
| Frontend Development       | VS Code, React.js       |
| Backend Development        | Node.js, Express.js     |
| Database                   | MySQL                   |
| Version Control            | Git                     |
| Code Repository            | GitHub                  |
| Project Management         | GitHub Projects, Trello |
| API Testing                | Postman                 |
| Testing                    | Jest, JUnit             |
| Documentation              | Markdown, MS Word       |

---

# Experiment 1: Introduction to Software Engineering Tools and Project Setup

## Aim

To select a real-world software project, form a project team, create a GitHub repository, establish the initial project structure, and demonstrate basic Git and GitHub version control operations.

---

# Objectives

* Select an appropriate real-world software project.
* Define project team roles and responsibilities.
* Create a GitHub repository.
* Create the initial project structure.
* Understand full-stack application development.
* Perform basic Git operations such as `add`, `commit`, `push`, `pull`, and `status`.
* Understand collaborative software development using GitHub.
* Plan the implementation of a smart product recommendation system.

---

# Tools Required

| Tool                        | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| Visual Studio Code          | Creating and managing project files       |
| Git                         | Version control                           |
| GitHub                      | Repository hosting and team collaboration |
| Web Browser                 | Accessing GitHub                          |
| Git Bash / VS Code Terminal | Executing Git commands                    |
| Node.js                     | Backend runtime                           |
| React.js                    | Frontend development                      |
| Express.js                  | Backend API development                   |
| MySQL                       | Database management                       |
| Postman                     | API testing                               |

---

# Introduction

**Git** is a distributed version control system used to track changes in source code and manage different versions of a project.

**GitHub** is a cloud-based platform used to host Git repositories and support collaborative software development.

Version control helps developers:

* Maintain project history
* Track changes
* Collaborate with team members
* Work on different features
* Recover previous versions
* Manage project development efficiently

The basic Git workflow is:

```text
Working Directory
       ↓
   git add
       ↓
Staging Area
       ↓
 git commit
       ↓
Local Repository
       ↓
  git push
       ↓
Remote Repository (GitHub)
```

---

# Problem Statement

Develop a **Full-Stack Online Grocery Store** using Software Engineering principles.

The system should provide an online grocery shopping platform where customers can register, login, browse and search products, view product details, add products to a shopping cart, place orders, track orders, and view order history.

The system should also provide **smart product recommendations** based on customer activity, previous purchases, product categories, similar products, and frequently purchased items.

The administrator should be able to manage products, inventory, customers, and orders.

The project should be maintained using Git and GitHub to support version control and collaborative software development.

---

# Selected Project

**Project Title:** Online Grocery Store

**Project Type:** Full-Stack Web Application

**Domain:** E-Commerce / Online Grocery Shopping

**Special Feature:** Smart Product Recommendation System

---

# Project Objective

The objective of the project is to develop a complete full-stack online grocery shopping platform that provides customers with a convenient and personalized shopping experience.

The system will provide:

1. User registration and login.
2. Secure user authentication.
3. Grocery product browsing.
4. Product search and filtering.
5. Product details.
6. Shopping cart management.
7. Order placement.
8. Order tracking.
9. Order history.
10. Admin product management.
11. Inventory management.
12. Smart product recommendations.
13. Personalized grocery suggestions.

---

# Project Team

| Role                              | Responsibility                                | Member          |
| --------------------------------- | --------------------------------------------- | --------------- |
| Project Manager                   | Planning, coordination and documentation      | Anurag          |
| Backend Developer                 | APIs, business logic and database integration | Anush Kumar     |
| Frontend Developer                | UI/UX and React frontend                      | Aryan Kanaujiya |
| Tester & Recommendation Developer | Testing and recommendation system             | Ayan Khan       |

---

# Project Setup

Create the following project structure in VS Code:

```text
online-grocery-store/
│
├── README.md
├── docs/
│   ├── SRS/
│   └── UML/
│
├── frontend/
│
├── backend/
│
├── recommendation/
│
├── test/
│
└── .gitignore
```

---

# Repository Creation Steps

1. Create a GitHub account and sign in.
2. Click **New Repository**.
3. Enter repository name:

```text
online-grocery-store
```

4. Choose **Public** or **Private** visibility.
5. Add a `README.md` file.
6. Click **Create Repository**.
7. Add the team members as collaborators.
8. Clone the repository or connect the local project to GitHub.
9. Create the project structure.
10. Commit and push the project files.

---

# Basic Git Commands

| Operation                 | Command                                  |
| ------------------------- | ---------------------------------------- |
| Check Git version         | `git --version`                          |
| Initialize repository     | `git init`                               |
| Check status              | `git status`                             |
| Add files                 | `git add .`                              |
| Commit changes            | `git commit -m "Initial project setup"`  |
| Connect remote repository | `git remote add origin <repository-url>` |
| Rename branch             | `git branch -M main`                     |
| Push changes              | `git push -u origin main`                |
| Pull latest changes       | `git pull origin main`                   |
| View history              | `git log --oneline`                      |

---

# Version Control Demonstration

## Step 1: Initialize the Local Repository

```bash
git init
```

This command initializes a new Git repository in the project directory.

---

## Step 2: Check Repository Status

```bash
git status
```

This command displays the current state of the working directory and staging area.

---

## Step 3: Add Project Files

```bash
git add .
```

This command adds all new and modified files to the staging area.

---

## Step 4: Create the First Commit

```bash
git commit -m "Initial project setup"
```

This command saves the staged changes in the local Git repository.

---

## Step 5: Connect Local Repository to GitHub

```bash
git remote add origin <repository-url>
```

Example:

```bash
git remote add origin https://github.com/username/online-grocery-store.git
```

---

## Step 6: Push Project to GitHub

```bash
git branch -M main
git push -u origin main
```

These commands rename the current branch to `main` and push the project to GitHub.

---

## Step 7: Make Changes and Commit

After making changes to the project:

```bash
git add .
git commit -m "Update project documentation"
```

---

## Step 8: Push Latest Changes

```bash
git push
```

This uploads the latest committed changes to GitHub.

---

## Step 9: View Commit History

```bash
git log --oneline
```

This displays the project's commit history.

---

## Step 10: Pull Changes from Team Members

```bash
git pull origin main
```

This command downloads and integrates the latest changes made by other team members.

---

# Smart Recommendation System

The Online Grocery Store includes a smart recommendation feature to provide personalized shopping suggestions.

The recommendation system can use the following information:

```text
User Activity
     │
     ├── Purchase History
     │
     ├── Browsing History
     │
     ├── Product Categories
     │
     ├── Frequently Purchased Products
     │
     └── Similar Products
             │
             ↓
    Recommendation Engine
             │
             ↓
    Personalized Products
```

### Recommendation Examples

If a customer frequently purchases:

```text
Milk
Bread
Butter
```

The system may recommend:

```text
Eggs
Jam
Cheese
```

Similarly, when a customer views a particular product, the system can display similar or related products.

---

# Future Recommendation Improvements

The recommendation system can later be improved using Machine Learning techniques such as:

* Collaborative Filtering
* Content-Based Filtering
* Hybrid Recommendation
* User Behavior Analysis
* Product Similarity
* Machine Learning Models

This will allow the system to provide more accurate and personalized product recommendations.

---

# Expected Outcome

The GitHub repository should contain the initial **Online Grocery Store** project structure along with:

* README file
* SRS documentation
* UML diagrams
* React frontend
* Node.js backend
* MySQL database integration
* Recommendation system
* Testing files
* `.gitignore`
* Git version history

All four team members should be able to access the repository and collaborate using GitHub.

The team should be able to perform basic Git operations such as:

```text
git status
git add
git commit
git push
git pull
git log
```

---

# Observation

Git and GitHub provide an effective mechanism for maintaining software versions and collaborating among team members.

The basic Git workflow consists of:

```text
Working Directory
        ↓
Staging Area
        ↓
Local Repository
        ↓
Remote Repository
```

Git allows the team to track changes, maintain project history, work collaboratively, and recover previous versions of the project.

---

# Result

The **Online Grocery Store** project was successfully selected and the project team was formed with:

* **Anurag**
* **Anush Kumar**
* **Aryan Kanaujiya**
* **Ayan Khan**

A GitHub repository was created and the initial full-stack project structure was established.

Basic Git version-control operations including **add, commit, push, pull, status, and log** were demonstrated.

The project is designed as a **Full-Stack Online Grocery Store with a Smart Product Recommendation System** and is ready for further development, testing, and implementation.

---

# Future Scope

The project can be further enhanced by adding:

* Online payment integration
* Product reviews and ratings
* Wishlist functionality
* Real-time order tracking
* Email and SMS notifications
* Multiple delivery addresses
* Coupon and discount system
* Admin analytics dashboard
* Advanced inventory management
* AI/ML-based product recommendations
* Voice-based product search
* Personalized offers
* Customer behavior analytics
* Cloud deployment
* Mobile application

---

# Conclusion

The **Online Grocery Store** provides practical understanding of Software Engineering, full-stack web development, Git, GitHub, database management, API development, and intelligent recommendation systems.

By using a structured repository, clearly defined team responsibilities, proper documentation, testing, and Git-based collaboration, the development team can efficiently develop and maintain the project.

The integration of a **Smart Product Recommendation System** further enhances the project by providing customers with personalized grocery suggestions and improving the overall online shopping experience.
