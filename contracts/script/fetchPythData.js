#!/usr/bin/env node

// Helper script to fetch Pyth price update data and return ABI-encoded bytes[]
const https = require("https");
const { ethers } = require("ethers");

const WETH_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

async function fetchPythData() {
  const url = `https://hermes.pyth.network/api/latest_vaas?ids[]=${WETH_PRICE_FEED_ID}`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            // Convert base64 VAAs to hex bytes
            const hexVaas = parsed.map(
              (vaa) => "0x" + Buffer.from(vaa, "base64").toString("hex")
            );

            // ABI-encode as bytes[] for Solidity
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const encoded = abiCoder.encode(["bytes[]"], [hexVaas]);

            // Output the encoded data (Foundry will capture stdout)
            process.stdout.write(encoded);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

fetchPythData().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
