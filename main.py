import requests

url = 'http://localhost:5000/api/users/check-username'
data = {'username': 'alaotach'}

response = requests.post(url, json=data)

print(response.json())

if response.json()['message'] == 'Username available':
    print('Username is available')