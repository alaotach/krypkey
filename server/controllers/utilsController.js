const axios = require('axios');

// Generate password using OpenAI API (optional - requires API key)
exports.generatePassword = async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        message: 'OpenAI API key not configured',
        password: generateFallbackPassword()
      });
    }

    // Call OpenAI API
    const response = await axios.post(
      'https://https://api.gptgod.online/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a secure password generator. Generate a single strong password that is memorable but secure. Do not include any explanation, just output the password.'
          },
          {
            role: 'user',
            content: `Generate a strong password for ${domain}. Make it at least 12 characters with mixed case, numbers and symbols.`
          }
        ],
        temperature: 0.7,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer sk-OsMMq65tXdfOIlTUYtocSL7NCsmA7CerN77OkEv29dODg1EA`,
          'Content-Type': 'application/json'
        }
      }
    );

    let password = response.data.choices[0].message.content.trim();
    
    // Clean up any extra text/quotes that might be in the response
    password = password.replace(/^["']|["']$/g, '').trim();
    
    // Ensure the password meets minimum requirements
    if (password.length < 12 || 
        !/[A-Z]/.test(password) || 
        !/[a-z]/.test(password) || 
        !/[0-9]/.test(password) || 
        !/[^A-Za-z0-9]/.test(password)) {
      password = generateFallbackPassword();
    }
    
    res.status(200).json({ password });
  } catch (error) {
    console.error('Error generating password:', error);
    
    // Provide a fallback password when API call fails
    const fallbackPassword = generateFallbackPassword();
    res.status(200).json({ 
      password: fallbackPassword,
      message: 'Used fallback generation due to API error'
    });
  }
};

// Fallback method for generating passwords without OpenAI
function generateFallbackPassword() {
  const length = 16;
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + special;
  let password = '';
  
  // Ensure we have at least one of each character type
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += special.charAt(Math.floor(Math.random() * special.length));
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}