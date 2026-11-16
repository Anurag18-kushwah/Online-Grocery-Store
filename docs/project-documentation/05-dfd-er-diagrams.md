# 5. Data Flow and ER Diagrams
## DFD Level 0
```mermaid
flowchart LR
 S[Shopper] -->|Search, cart, checkout| G((GrocerAI))
 G -->|Products, suggestions, order status| S
 A[Admin] -->|Catalogue and order updates| G
 G -->|Dashboard results| A
 G <-->|Optional language request/response| L[LLM provider]
 G <-->|Read and write| DB[(Application store)]
```

## DFD Level 1
```mermaid
flowchart TB
 S[Shopper] --> P1[Account and session]
 S --> P2[Catalogue and search]
 S --> P3[Cart and wishlist]
 S --> P4[Checkout and orders]
 S --> P5[Recommendations and assistant]
 A[Admin] --> P6[Administration]
 P1 <--> D1[(Users and preferences)]
 P2 <--> D2[(Products and categories)]
 P3 <--> D3[(Carts and wishlists)]
 P4 <--> D4[(Orders and stock)]
 P5 <--> D1
 P5 <--> D2
 P5 <--> D5[(Recipes)]
 P5 -. optional .-> L[LLM]
 P6 <--> D2
 P6 <--> D4
```

## ER diagram
```mermaid
erDiagram
 USER ||--o| USER_PREFERENCE : has
 USER ||--o{ WISHLIST : owns
 USER ||--o{ ORDER : places
 CATEGORY ||--o{ PRODUCT : groups
 PRODUCT ||--o{ CART_ITEM : appears_in
 PRODUCT ||--o{ ORDER_ITEM : purchased_as
 USER ||--o{ RECOMMENDATION_EVENT : may_generate
 PRODUCT ||--o{ RECOMMENDATION_EVENT : referenced_by
 USER { ObjectId id PK string name string email UK string passwordHash string role }
 USER_PREFERENCE { ObjectId id PK ObjectId userId FK string[] dietary string[] avoidAllergens number monthlyBudget boolean personalisationConsent }
 CATEGORY { ObjectId id PK string slug UK string name }
 PRODUCT { ObjectId id PK string slug UK string name string category number price number stock string unit number packSize }
 CART { ObjectId id PK string ownerKey UK array items }
 WISHLIST { ObjectId id PK ObjectId userId FK ObjectId[] productIds }
 ORDER { ObjectId id PK ObjectId userId FK number total string status string payment }
 RECIPE { ObjectId id PK string slug UK string name number servings }
```

## Explanation
Account flows access user/preferences. Catalogue reads products/categories. Cart uses `u:<userId>` or `g:<guestId>`. Checkout revalidates stock and creates an order. Recommendation/recipe services read product, preference, and recipe data. Admin actions update catalogue, stock, categories, and orders.
