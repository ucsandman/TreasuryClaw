const { ethers } = require('ethers');

async function check() {
  const address = '0x2a15C6A98324e179dD9adf87bDD59F9C77f19d12';
  
  // Base
  const baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const baseBal = await baseProvider.getBalance(address);
  console.log('Base:', ethers.formatEther(baseBal));
  
  // Sepolia
  const sepoliaProvider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
  const sepoliaBal = await sepoliaProvider.getBalance(address);
  console.log('Sepolia:', ethers.formatEther(sepoliaBal));
  
  // Eth Mainnet
  const ethProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  const ethBal = await ethProvider.getBalance(address);
  console.log('Mainnet:', ethers.formatEther(ethBal));
}
check().catch(console.error);