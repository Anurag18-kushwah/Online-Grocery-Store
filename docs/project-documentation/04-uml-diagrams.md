# 4. UML Diagrams
These are documentation-level Mermaid models of the supplied web application.

## Use cases
```mermaid
flowchart LR
 G[Guest] --> B((Browse and search))
 G --> C((Guest cart))
 U[Registered shopper] --> B
 U --> C
 U --> P((Profile and preferences))
 U --> W((Wishlist))
 U --> O((Checkout and orders))
 U --> R((Recommendations))
 U --> M((Recipes and meal plans))
 U --> X((Basket optimisation))
 A[Admin] --> D((Manage products and stock))
 A --> K((Manage categories))
 A --> Q((Manage orders and stats))
```

## Domain class model
```mermaid
classDiagram
 class User {name email passwordHash role addresses}
 class UserPreference {userId dietary avoidAllergens favouriteBrands monthlyBudget personalisationConsent}
 class Product {slug name category brand price stock unit packSize allergens dietaryLabels}
 class Category {slug name emoji color}
 class Cart {ownerKey items}
 class Wishlist {userId productIds}
 class Order {userId items total status payment address}
 class Recipe {slug name servings dietary ingredients}
 User "1" --> "0..1" UserPreference
 User "1" --> "0..*" Wishlist
 User "1" --> "0..*" Order
 Category "1" --> "0..*" Product
 Recipe ..> Product : ingredient matching
```

## Login sequence
```mermaid
sequenceDiagram
 actor Shopper
 participant UI as React
 participant API as Express
 participant Auth as Auth service
 participant DB as Store
 Shopper->>UI: Submit credentials
 UI->>API: POST /api/auth/login
 API->>Auth: Validate credentials
 Auth->>DB: Find user
 DB-->>Auth: User and password hash
 Auth->>Auth: Compare hash
 Auth-->>API: JWT and safe user data
 API-->>UI: JSON response
 UI-->>Shopper: Signed-in state
```

## Checkout activity
```mermaid
flowchart TD
 A([Start]) --> B[Review cart]
 B --> C[Submit address and payment mode]
 C --> D{Signed in?}
 D -- No --> E[Request sign-in]
 E --> C
 D -- Yes --> F[Revalidate products and stock]
 F --> G{Stock valid?}
 G -- No --> H[Return stock/validation error]
 H --> B
 G -- Yes --> I[Create order and update stock]
 I --> J[Confirmation]
 J --> K([End])
```

## Order lifecycle
```mermaid
stateDiagram-v2
 [*] --> placed
 placed --> packed
 placed --> cancelled
 packed --> delivered
 packed --> cancelled
 delivered --> [*]
 cancelled --> [*]
```
