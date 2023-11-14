# Friend Tech Fork

This is a friend.tech fork contract. This works on bounding curve mechanism. It charges fee to users in a ERC20 token instead of ethers. 

## Fee
Fee is being divided into 3 authorities. Initial fee is accumulated 10% in the smart contract. But you can change it by using the setter functions.

## Fund token
Fund token is the token that will be used to pay the fee. Instead of ethers. You can only set it once when you are deploying the contract. 
**Note** Token decimals must be 18. Otherwise smart contract will not work in expected manner.


## Commands
```shell
npm run compile
npm run test
```
