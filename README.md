# Simple Wine Cellar
Wine cellar inventory with QR codes in a simple web app.

![alt text](/baileyscellar.gif)

## Getting started
This hacky, homely little project was written just for personal use in my cellar. That's why I beautified and productionized it into [Cellar Project](https://cellarproject.com), which has a nicer interface, supports infinite users, and sends you QR codes in the mail.

Cellar Project is still closed-source, but this repo contains code for its predecessor, which is shown in the GIF above. I originally posted this project [here on r/wine](https://www.reddit.com/r/wine/comments/auuh6a/finally_figured_out_how_to_get_my_wife_to_check/).

If you want to use this CRUDdy old web app - haha, get it? - you'll need to do the following.

### Deploy the backend
Create an AWS account if you don't have one. Create a Cognito user pool. Add a user in the console. Change the password by uncommenting the `newPasswordRequired` lines in `webapp/js/baileys-cellar-webapp.js`. Create a DynamoDB table with an index for bottle numbers. Add the table and index names at the top of `backend/web_lambda.js`. Create an API Gateway API with a single POST endpoint called `crud`. Point it at a Lambda that contains `backend/web_lambda.js`.

### Host the frontend
Upload the contents of `webapp` to a static web hosting service like AWS S3.

### Print QR codes
Buy some sticker sheets. The sticker in the video is 1.5" in diameter, which I thought was a perfect size. Get a ruler and make measurements like those in `qr/requirements.txt`. Pass them as console args to `qr/generate_qr_sheets.py` and print the resulting images onto your sticker sheets.

### Populate your database
Get a printed sticker and put it on your bottle. Scan the label to open the web app - the default camera app in iOS can do it. Fill in the add form.

## Drinkability classification
When an entry doesn't have a lower and upper drink-by year, I consider it
* "mature" up to three years after vintage
* "drink soon" between three and five years
* "past prime" after five.

A wine with a lower and upper year is considered 
* "undrinkable" (even though that's not really true) between vintage and the lower year
* "young" until 25% of the way between lower and upper
* "mature" between 25% and 75%
* "drink soon" between 75% and 100%
* "past prime" after that.

## Limitations
### For end users
1. Credentials aren't cached on the frontend, so you have to login every time you refresh. You also have to play with code every time you add a user - by uncommenting and recommenting `newPasswordRequired` - which is a pain.
2. QR codes encode passwords in plain-text. That's obviously horrible, but then I wrote this for exactly two users 😅. That means that if your friends want to be giant buttholes, they can log into your account and wreak havoc after you open a bottle with them. Not that, uh, my friends are giant buttholes...
3. The cellar database isn't backed up programmatically.

### For developers
1. There is no programmatic deployment, so you have to copy-paste the lambda's contents and drag-drop the frontend code into S3. Ideally the lambda would be deployed with Serverless and the frontend would be deployed with a simple script containing an AWS CLI command.
2. The code isn't minified or otherwise obfuscated before deployment.
3. The code that generates the table in `webapp/js/baileys-cellar-webapp.js` is super hacky. JQuery or something else should be used instead of whatever I did 🙃
4. PWA support is incomplete because there's no service worker.

## License
This project is licensed under the MIT License.
