# Wallet Safety & Sign-In

> **Status:** Player Guide (Summary)  
> **Last Verified:** 2025-11-20T05:48:34Z (UTC)

## 1. How Sign-In Works

Bloblet uses a standard, non-custodial **“Sign in with wallet”** flow.

1. **Connect:** You connect a supported wallet (for example, Phantom or Solflare) to the app.
2. **Challenge:** The game sends a short, one-time message for you to sign. This does not cost gas.
3. **Sign:** You sign that message in your wallet. This proves that you control the address.
4. **Session:** The game creates a temporary session tied to your wallet so you can play without signing every single click.

At no point do we see or store your private key.

### 1.1 What We Can and Cannot Do

With your permission, we can:
- See your public address.
- Check balances that matter for the game.
- Ask you to sign transactions or messages.

We cannot:
- Read or extract your private key.
- Move funds without a signature in your wallet.
- Access other wallets you have not connected.

## 2. Sessions and Timeouts

- Your gameplay session will eventually **expire**, especially if you are inactive for a while.
- When this happens, you may be asked to sign in again before you can take actions that touch RP or tokens.
- Some advanced flows may use short-lived “session-like” approvals to smooth gameplay, but they are always limited in scope and time.

If in doubt, you can always disconnect your wallet from the app and from your wallet’s own connection list.

## 3. Staying Safe

Basic safety rules apply here just like anywhere else:
- **Never share your seed phrase or private key.** Nobody from Bloblet will ever ask for it.
- **Check the URL** before you connect and sign. Only use official links.
- **Read what you sign** in your wallet, especially if it could move funds.

If something ever looks off, stop, disconnect, and ask the community or team for help before proceeding.
