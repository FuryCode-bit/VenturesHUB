<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Stargazers][stars-shield]][stars-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/FuryCode-bit/VenturesHUB">
    <img src="https://raw.githubusercontent.com/FuryCode-bit/VenturesHUB/master/readme/logo.png" alt="Logo" height="80">
  </a>

<h3 align="center">VentureHUB: A Web3 Platform for Startup Investment</h3>

  <p align="center">
    A full-stack Web3 application revolutionizing startup fundraising through equity tokenization, decentralized governance, and a liquid secondary market.
    <br />
    <br />
    <a href="https://github.com/FuryCode-bit/VenturesHUB"><strong>Explore the Project »</strong></a>
    <br />
    <br />
    <a href="https://github.com/FuryCode-bit/VenturesHUB/issues">Report Bug</a>
    ·
    <a href="https://github.com/FuryCode-bit/VenturesHUB/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#the-venturehub-vision">The VentureHUB Vision</a></li>
        <li><a href="#core-features">Core Features</a></li>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#environment-setup">Environment Setup</a></li>
        <li><a href="#database-setup">Database Setup</a></li>
      </ul>
    </li>
    <li><a href="#running-the-application">Running the Application</a></li>
    <li><a href="#core-user-workflows">Core User Workflows</a></li>
    <li><a href="#system-architecture">System Architecture</a></li>
    <li><a href="#api-endpoints-guide">API Endpoints Guide</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

---

<!-- ABOUT THE PROJECT -->
## About The Project

[![Project Screenshot][project-screenshot]](https://github.com/FuryCode-bit/VenturesHUB)

VentureHUB is a full-stack Web3 application designed to revolutionize startup fundraising. It leverages blockchain technology to allow entrepreneurs to tokenize their company's equity, raise capital in a transparent and decentralized manner, and manage their venture through a community-driven DAO.

This platform provides a complete ecosystem for the startup lifecycle: from launching an idea as a fractionalized IP-NFT to managing secondary market trading and on-chain governance.

### The VentureHUB Vision

In the traditional startup world, equity is illiquid, fundraising is opaque, and governance is centralized. VentureHUB challenges this paradigm by providing:

*   **Liquidity for Founders:** Entrepreneurs can access capital without waiting for traditional funding rounds by selling fractionalized equity on an open market.
*   **Access for Investors:** VCs and angel investors can discover and invest in vetted, early-stage ventures with on-chain transparency.
*   **Decentralized Governance:** Every share is a vote. Stakeholders can directly influence the direction of a venture by creating and voting on governance proposals.

### Core Features

*   **Venture Creation:** Entrepreneurs can launch their venture, creating an on-chain IP-NFT representing the core charter and minting fractional share tokens (`ERC20Votes`).
*   **Primary Sale (Deal Flow):** Ventures can raise their initial seed round through a dedicated `SaleTreasury` contract.
*   **Secondary Marketplace:** A peer-to-peer marketplace allows any shareholder to list their shares for sale and any user to purchase them, creating a liquid secondary market.
*   **DAO Governance:** A full-featured governance system based on OpenZeppelin Governor allows token holders to create, vote on, and execute on-chain proposals.
*   **Gasless Transactions:** Key governance actions like voting and proposing are designed as meta-transactions, where the backend relays the user's signed message and pays the gas fee, providing a smoother user experience.

### Built With

This project leverages a modern and powerful stack for Web3 development.

| Category | Technologies |
| :--- | :--- |
| **Blockchain** | [![Solidity][Solidity-shield]][Solidity-url] [![Hardhat][Hardhat-shield]][Hardhat-url] [![Ethers.js][Ethers.js-shield]][Ethers.js-url] [![OpenZeppelin][OpenZeppelin-shield]][OpenZeppelin-url] |
| **Backend** | [![Node.js][Node.js-shield]][Node.js-url] [![Express.js][Express.js-shield]][Express.js-url]  [![JWT][JWT-shield]][JWT-url] |
| **Frontend** | [![React][React-shield]][React-url] [![Material-UI][MUI-shield]][MUI-url] [![Axios][Axios-shield]][Axios-url] |
| **Database** | [![MySQL][MySQL-shield]][MySQL-url] |
| **IPFS** | Pinata |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

Follow these steps to set up and run the VentureHUB platform locally.

### Prerequisites

*   **Node.js** (v18.x or later) & **npm**
*   **Git**
*   A local or cloud-based **MySQL/MariaDB** server
*   A **Pinata** account for IPFS hosting ([Get Keys Here](https://app.pinata.cloud/keys))
*   A browser with the **MetaMask** extension

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/FuryCode-bit/VenturesHUB.git
    cd VentureHUB
    ```
2.  Install all dependencies for the monorepo components:
    ```sh
    # Install dependencies for backend
    cd backend && npm install && cd ..
    # Install dependencies for frontend
    cd frontend && npm install && cd ..
    # Install root dependencies
    npm install
    ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Environment Setup

The project uses a central `.env` file in the root directory for all configuration.

1.  Create the `.env` file from the example:
    ```sh
    cp .env.example .env
    ```

2.  Edit the `.env` file with your specific credentials:
    ```env
    # --- DATABASE ---
    DB_HOST=127.0.0.1
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_NAME=venturehub

    # --- AUTH ---
    JWT_SECRET=replace_with_a_very_strong_and_long_secret_key_for_jwt

    # --- IPFS (get from app.pinata.cloud/keys) ---
    PINATA_API_KEY=your_pinata_api_key
    PINATA_API_SECRET=your_pinata_api_secret

    # --- BLOCKCHAIN ---
    # The default URL for the local Hardhat node
    JSON_RPC_URL=http://127.0.0.1:8545
    # The default private key for the deployer account (Account #0 from `npx hardhat node`)
    DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
    
    # These will be auto-populated by the deployment script
    VENTURE_FACTORY_ADDRESS=
    MOCK_USDC_CONTRACT_ADDRESS=
    MARKETPLACE_ADDRESS=
    ```

### Database Setup

1.  Log in to your MySQL/MariaDB client:
    ```sh
    mysql -u your_db_user -p
    ```
2.  Create the database:
    ```sql
    CREATE DATABASE venturehub;
    ```
3.  Set up or reset the database schema by running the script:
    ```sh
    node scripts/database/reset-db.js
    ```
    > This script reads the schema and executes it directly against the database, making it ideal for initialization and resetting.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Running the Application

To launch the full application, you will need **four separate terminal windows**.

1.  **Terminal 1: Start the Local Blockchain**
    This command starts a local Hardhat node, simulating the Ethereum network.
    ```sh
    cd backend
    npx hardhat node
    ```

2.  **Terminal 2: Deploy Smart Contracts**
    This script compiles and deploys all contracts to your local node and automatically updates your `.env` file with the deployed contract addresses.
    ```sh
    cd backend
    npx hardhat run scripts/deploy.js --network localhost
    ```

3.  **Terminal 3: Start the Backend Server**
    This runs the API that connects your frontend to the database and IPFS.
    ```sh
    cd backend
    npm start
    ```

4.  **Terminal 4: Start the Frontend Application**
    This launches the React development server. Your browser should open to **http://localhost:3000**.
    ```sh
    cd frontend
    npm start
    ```

## Core User Workflows

1.  **Setup MetaMask:**
    *   Add a new network:
        *   **Network Name:** `Hardhat Local`
        *   **RPC URL:** `http://127.0.0.1:8545`
        *   **Chain ID:** `31337`
    *   Import a test account using one of the private keys provided by the `npx hardhat node` command.

2.  **Register & Link Wallet:** Create an "Entrepreneur" and a "VC" account. Log in and link your imported MetaMask account to each.

3.  **Launch a Venture (as Entrepreneur):** Navigate to "Launch New Venture" and fill out the form. This triggers the on-chain creation of the Venture IP-NFT and all associated DAO contracts.

4.  **Invest (as VC):**
    *   Use the "Exchange" page to get some MockUSDC.
    *   Go to "Deal Flow," find the new venture, and invest.

5.  **Trade (Secondary Market):**
    *   Navigate to the "Marketplace."
    *   As a shareholder, list a portion of your shares for sale.
    *   Any other user can buy these listed shares.

6.  **Govern (as any Shareholder):**
    *   Go to a venture's "Manage/Govern" page.
    *   **Activate Votes:** You must delegate voting power to your own address once to participate.
    *   **Submit & Vote:** Create new proposals and cast your vote on active ones (gas-free).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ARCHITECTURE -->
## System Architecture

VentureHUB is a monorepo containing three main components that work in concert:

1.  **Smart Contracts (`/backend/contracts`):** The Solidity-based on-chain logic, built with Hardhat. It handles all core functionalities like token creation, sales, and governance.
2.  **Backend (`/backend`):** A Node.js/Express server that acts as a secure bridge. It manages user authentication (JWT), pins metadata to IPFS via Pinata, and relays meta-transactions.
3.  **Frontend (`/frontend`):** A React (MUI) single-page application that serves as the user interface, interacting with both the backend API and directly with the blockchain via a Web3 wallet (MetaMask).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- API ENDPOINTS -->
## API Endpoints Guide

A summary of the VentureHUB backend API. `(Protected)` endpoints require a valid JWT.

#### Authentication (`/api/auth`)
*   `POST /register`: Registers a new user (`fullName`, `email`, `password`, `role`).
*   `POST /login`: Logs in a user, returning a JWT (`email`, `password`).

#### User Management (`/api/users`)
*   `POST /link-wallet` **(Protected)**: Links a wallet address to the user's account (`walletAddress`).

#### Venture Management (`/api/ventures`)
*   `POST /create` **(Protected)**: Launches a new venture.
*   `GET /`: Fetches all ventures.
*   `GET /:id`: Fetches details for a single venture.
*   `GET /:id/stats`: Fetches live on-chain stats for a venture.
*   `GET /:ventureId/dashboard`: Aggregates all data for the DAO governance page.

#### Portfolio & Investments (`/api/portfolio`, `/api/investments`)
*   `GET /portfolio/all` **(Protected)**: Fetches the user's complete, on-chain portfolio.
*   `POST /investments/record` **(Protected)**: Records a new investment relationship.

#### Marketplace (`/api/market`)
*   `POST /listings` **(Protected)**: Records a new share listing.
*   `GET /listings`: Fetches all open listings.
*   `PUT /listings/:listingId` **(Protected)**: Updates a listing's status (`'sold'` or `'cancelled'`).

#### Governance (Meta-Transactions) (`/api/governance`, `/api/proposals`)
*   `POST /proposals/record` **(Protected)**: Records a new proposal in the DB.
*   `POST /governance/vote-gasless` **(Protected)**: Relays a user's signed vote to the blockchain.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Authors

The following members contributed to the development of this project:

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/DiogoSilveira6300">
        <img src="https://avatars.githubusercontent.com/u/44781864?v=4" width="100px;" alt="Fábio Ferreira"/><br>
        <sub>
          <b>Diogo Silveira</b>
        </sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/FuryCode-bit">
        <img src="https://avatars2.githubusercontent.com/u/62396294?s=400&u=7017c42401bedbcc13df785146962b6cd128e658&v=4" width="100px;" alt="Marco Bernardes"/><br>
        <sub>
          <b>Marco Bernardes</b>
        </sub>
      </a>
    </td>
  </tr>
</table>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

This project was developed as part of the Distributed Ledger Technologies (Tecnologias de Ledger Distribuído) course in the Cybersecurity program at the University of Aveiro.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/FuryCode-bit/VenturesHUB.svg?style=for-the-badge
[contributors-url]: https://github.com/FuryCode-bit/VenturesHUB/graphs/contributors
[stars-shield]: https://img.shields.io/github/stars/FuryCode-bit/VenturesHUB.svg?style=for-the-badge
[stars-url]: https://github.com/FuryCode-bit/VenturesHUB/stargazers
[license-shield]: https://img.shields.io/github/license/FuryCode-bit/VenturesHUB.svg?style=for-the-badge
[license-url]: https://github.com/FuryCode-bit/VenturesHUB/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/bernardeswebdev
[project-screenshot]: https://github.com/FuryCode-bit/VenturesHUB/master/readme/project.png

<!-- Tech Shields -->
[Solidity-shield]: https://img.shields.io/badge/Solidity-363636?style=for-the-badge&logo=solidity&logoColor=white
[Solidity-url]: https://soliditylang.org/
[Hardhat-shield]: https://img.shields.io/badge/Hardhat-25292F?style=for-the-badge&logo=hardhat&logoColor=white
[Hardhat-url]: https://hardhat.org/
[Ethers.js-shield]: https://img.shields.io/badge/Ethers.js-2535A4?style=for-the-badge&logo=ethers&logoColor=white
[Ethers.js-url]: https://ethers.io/
[OpenZeppelin-shield]: https://img.shields.io/badge/OpenZeppelin-4E5EE4?style=for-the-badge&logo=openzeppelin&logoColor=white
[OpenZeppelin-url]: https://www.openzeppelin.com/
[Node.js-shield]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node.js-url]: https://nodejs.org/
[Express.js-shield]: https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white
[Express.js-url]: https://expressjs.com/
[MySQL-shield]: https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white
[MySQL-url]: https://www.mysql.com/
[JWT-shield]: https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white
[JWT-url]: https://jwt.io/
[React-shield]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[MUI-shield]: https://img.shields.io/badge/MUI-007FFF?style=for-the-badge&logo=mui&logoColor=white
[MUI-url]: https://mui.com/
[Axios-shield]: https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white
[Axios-url]: https://axios-http.com/