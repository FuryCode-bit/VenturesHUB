# VentureHUB - Frontend

## 1. Overview

This is the frontend for the VentureHUB platform, a modern Single Page Application (SPA) built with React. It provides the complete user interface for entrepreneurs and investors to interact with the VentureHub ecosystem.

The application is responsible for:
-   User onboarding (Login/Register).
-   Displaying venture data fetched from the backend API.
-   Providing interfaces for creating ventures and proposals.
-   **Directly interacting with the blockchain** for financial transactions. It connects to the user's browser wallet (like MetaMask) to allow them to personally sign and pay for actions like investing, trading on the marketplace, and executing DAO proposals.

## 2. Technology Stack

-   **Framework:** React (Create React App)
-   **UI Library:** Material-UI (MUI)
-   **Routing:** React Router (`react-router-dom`)
-   **Blockchain Interaction:** Ethers.js (`ethers`)
-   **HTTP Client:** Axios

---

## 3. Setup and Installation

### Prerequisites

-   Node.js (v16 or higher)
-   NPM or Yarn
-   A browser with a Web3 wallet extension (e.g., MetaMask) installed and connected to the correct network (e.g., Sepolia).

### Installation Steps

1.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running the Application

-   To start the development server:
    ```bash
    npm start
    ```
The application will open in your browser, typically at `http://localhost:3000`.

---

## 4. Core Components & Pages

The application is structured into several key pages, each representing a core feature of the platform.

-   **Authentication (`LoginPage`, `RegisterPage`):** Handles user sign-in and registration.
-   **Incubation (`IncubatePage`):** A form for entrepreneurs to launch a new venture. This page communicates with the backend's relayer endpoint.
-   **Deal Flow (`DealFlowPage`):** The primary market where investors can discover and invest in ventures. This page initiates on-chain `buyShares` transactions from the user's wallet.
-   **Marketplace (`MarketplacePage`):** The secondary P2P market. Allows users to list their shares for sale and buy shares from others. All `list` and `buy` actions are direct on-chain transactions paid for by the user.
-   **DAO Governance (`SteeringCommitteePage`):** The dashboard for a venture's DAO. Users can view proposals, vote (gas-based), and execute successful proposals (gas-based).
-   **User Dashboards (`MyVenturesPage`, `VcPortfolioPage`):** Personalized pages showing entrepreneurs the ventures they've launched and investors the portfolio of shares they own.
-   **Utilities (`CoinExchangePage`, `AdminPage`):** Helper pages to swap test ETH for USDC and for admins to set simulated market prices.

## 5. Interacting with Smart Contracts

A key design principle of this frontend is the direct user-to-blockchain interaction for sensitive financial operations.

-   **Connection:** The application uses `new ethers.BrowserProvider(window.ethereum)` to connect to the user's injected wallet.
-   **Transactions:** When a user decides to invest, trade, or execute a proposal, the application helps construct the transaction, but the user is **always** prompted by their wallet to give final approval and pay the gas fee. This ensures a non-custodial and secure user experience.