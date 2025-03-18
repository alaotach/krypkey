// filepath: /c:/Users/nobit/krypkey/lala.js
// const axios = require('axios');
const ethers = require('ethers');

const checkUsername = async () => {
    try {
        const response = await axios.post('http://localhost:5000/api/users/check-username', 'alaotach');
        console.log(response.data);
        if (response.data.message === 'Username available') {
            // setIsUsernameValid(true);
            console.log('Username available', 'You can use this username.');
        }
    } catch (error) {
        // setIsUsernameValid(false);
        console.log('Username already taken', 'Please choose a different username.');
    }
};
        // const phrase = 'shoulder fever say autumn sunny ignore donate broken bacon cake shrimp naive'
        // const wallet = ethers.Wallet.fromPhrase(phrase);
        // console.log(wallet.privateKey);
    // }

checkUsername();