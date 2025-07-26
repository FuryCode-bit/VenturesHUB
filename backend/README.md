# VentureHUB - Backend API & Blockchain Relayer

## 1. Overview

This is the backend server for the VentureHUB platform. It is a Node.js application built with the Express framework. This server serves two primary purposes:

1.  **REST API:** It provides a comprehensive set of RESTful endpoints for user authentication, data persistence, and fetching aggregated on-chain/off-chain data for the frontend. It uses a MySQL database to store user and venture information.
2.  **Blockchain Relayer:** For specific, pre-defined actions (like creating a new venture or casting a gasless vote), the backend acts as a trusted relayer. It uses a secure operator wallet to pay the gas fees, abstracting away this cost and complexity from the end-user.

## 2. Technology Stack

-   **Framework:** Node.js, Express.js
-   **Database:** MySQL (`mysql2/promise`)
-   **Authentication:** JSON Web Tokens (`jsonwebtoken`, `bcryptjs`)
-   **Blockchain Interaction:** Ethers.js (`ethers`)
-   **IPFS:** Pinata SDK (`@pinata/sdk`) for NFT metadata management
-   **File Uploads:** `multer` for handling venture logo uploads

---

## 3. Setup and Installation

### Prerequisites

-   Node.js (v16 or higher)
-   NPM or Yarn
-   A running MySQL server instance
-   Access to a Pinata account for IPFS pinning

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/FuryCode-bit/VentureHUB.git
    cd VentureHUB/backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up the Database:**
    Log in to your MySQL/MariaDB client: `mysql -u your_db_user -p`
    Create the database: `CREATE DATABASE venturehub;`
    Setup the database using the script in `scripts/database/reset-db.js`

    > The script select everything from the schema and executes directly in the database. It is a good option also to reset the DB.

4. **Setup the Blockchain Node**  
    
    1. **Terminal 1: Start the Local Blockchain**
    
    This command starts a local Hardhat node, simulating the Ethereum network.
    ```bash
    npx hardhat node
    ```

    2. **Terminal 2: Deploy Smart Contracts**

    This script compiles and deploys all contracts to your local node and automatically updates your `.env` file with the deployed contract addresses.
    ```bash
    npx hardhat run scripts/deploy.js --network localhost
    ```

### Running the Server

-   To start the server:
    ```bash
    npm start
    ```

The API will be available at `http://localhost:4000`.

---

## 4. API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint        | Description                               |
| :----- | :-------------- | :---------------------------------------- |
| `POST` | `/register`     | Creates a new user account.               |
| `POST` | `/login`        | Logs in a user, returns a JWT.          |

### Ventures (`/api/ventures`)

| Method | Endpoint                     | Description                                                                                              | Protected |
| :----- | :--------------------------- | :------------------------------------------------------------------------------------------------------- | :-------- |
| `POST`   | `/create`                    | **(Relayer)** Creates a complete on-chain venture ecosystem. Handles IPFS uploads and contract deployment. | Yes       |
| `GET`    | `/`                          | Fetches a list of all ventures for the deal flow page.                                                   | Yes       |
| `GET`    | `/:id`                       | Fetches detailed information for a single venture from the database.                                     | Yes       |
| `GET`    | `/:id/stats`                 | Fetches live on-chain stats for a venture's `SaleTreasury`.                                              | Yes       |
| `GET`    | `/:ventureId/dashboard`      | Aggregates all data (DB + on-chain) for the DAO governance dashboard.                                    | Yes       |
| `GET`    | `/:ventureId/shareholders`   | Fetches a list of shareholders for a specific venture.                                                   | Yes       |

### Governance (`/api/governance`, `/api/proposals`)

| Method | Endpoint                | Description                                                          | Protected |
| :----- | :---------------------- | :------------------------------------------------------------------- | :-------- |
| `POST` | `/proposals/create`     | **(Relayer)** Submits a new governance proposal on-chain.            | Yes       |
| `POST` | `/governance/vote-gasless` | **(Relayer)** Relays a user's signed vote to the blockchain.        | Yes       |

### Portfolio & Marketplace (`/api/portfolio`, `/api/market`)

| Method | Endpoint                | Description                                                               | Protected |
| :----- | :---------------------- | :------------------------------------------------------------------------ | :-------- |
| `GET`  | `/portfolio/all`        | Fetches all ventures owned by the logged-in user with live on-chain data. | Yes       |
| `POST` | `/investments/record`   | Records a user's investment in the database after a successful purchase. | Yes       |
| `POST` | `/market/listings`      | Records a new marketplace listing in the database for fast retrieval.    | Yes       |
| `PUT`  | `/market/listings/:id`  | Updates the status of a listing (e.g., to "sold").                     | Yes       |
| `GET`  | `/market/listings`      | Fetches all open listings from the database.                              | Yes       |