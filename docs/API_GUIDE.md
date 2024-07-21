# API Guide for Smart Dorm Door Control System

## Base URL

All API requests should be sent to: `https://door.ammaar.xyz/api`

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header: `Authorization: Bearer <your_jwt_token>`

## Endpoints

### 1. Login

- **URL:** `/login`
- **Method:** `POST`
- **Auth required**: No
- **Data constraints:**

```json
{
  "password": "[valid password string]"
}
```
#### Success Response:

- **Code**: `200`
- **Content** : `{ "message": "Login successful", "token": "[JWT Token]" }`


### 2. Get Door Status
- **URL**: `/status`
- **Method**: `GET`
- **Auth required**: `Yes`
- **Success Response**:
  - **Code**: `200`
  - **Content** : `{ "message": "Login successful", "token": "[JWT Token]" }`

### 3. Send Door Command

- **URL**: `/command`
- **Method**: `POST`
- **Auth required**: Yes
- **Data Constraints**:
```json
{
  "command": "[open|close]"
}
```
- **Success Response**:
  - **Code**: `200`
  - **Content** : `Command sent successfully}`

### 4. Emergency Close

- **URL**: `/emergency-close`
- **Method**: `POST`
- **Auth required**: Yes
- **Success Response**:
  - **Code**: `200`
  - **Content** : `Emergency close Command sent successfully}`

## Error Responses

- **Condition**: If not authenticated or invalid token
  - **Code**: `403`
  - **Content**: `{ "message": "Not authenticated" }`

- **Condition**: If internal server error
  - **Code**: `500`
  - **Content**: `Internal Server Error`

## Examples

### Curl Examples

#### 1. Login:
```
curl -X POST https://door.ammaar.xyz/api/login -H "Content-Type: application/json" -d '{"password":"your_password"}'
```

#### 2. Get Status (after login:
```
curl https://door.ammaar.xyz/api/status -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 3. Send Open Command:
```
curl -X POST https://door.ammaar.xyz/api/command -H "Authorization: Bearer YOUR_JWT_TOKEN" -H "Content-Type: application/json" -d '{"command":"open"}'
```
