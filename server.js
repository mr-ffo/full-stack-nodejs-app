import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { engine } from 'express-handlebars';

const app = express();

// Handlebars setup (using .hbs extension)
app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', './views');

// Body parsers / static / session
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(session({ secret: process.env.SESSION_SECRET || 'devops-secret', resave: false, saveUninitialized: false }));

// DynamoDB
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.DDB_TABLE || 'Users';

// Routes
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/signin');
    res.render('index', { user: req.session.user });
});

app.get('/signup', (_, res) => res.render('register'));
app.get('/signin', (_, res) => res.render('register'));

/**
 * SIGNUP
 * - validate input
 * - check if user exists
 * - hash password with bcrypt
 * - store hashed password in DynamoDB
 */
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).render('register', { error: 'All fields are required.' });
    }

    try {
        // check existing user
        const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { email } }));
        if (existing.Item) {
            return res.status(409).render('register', { error: 'Email already registered.' });
        }

        // hash password
        const hashed = await bcrypt.hash(password, 10);

        // store user
        await ddb.send(new PutCommand({ TableName: TABLE, Item: { email, name, password: hashed } }));

        // redirect to signin page after successful signup
        return res.redirect('/signin');
    } catch (e) {
        console.error('signup error', e);
        return res.status(500).render('register', { error: 'Server error during signup.' });
    }
});

/**
 * SIGNIN
 * - validate input
 * - fetch user by email
 * - compare password with bcrypt.compare
 * - start session on success
 */
app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).render('register', { error: 'Email and password required.' });
    }

    try {
        const { Item } = await ddb.send(new GetCommand({ TableName: TABLE, Key: { email } }));
        if (!Item) return res.status(401).render('register', { error: 'Invalid credentials.' });

        const match = await bcrypt.compare(password, Item.password);
        if (!match) return res.status(401).render('register', { error: 'Invalid credentials.' });

        // set session user (only store non-sensitive info)
        req.session.user = { email: Item.email, name: Item.name };
        return res.redirect('/');
    } catch (e) {
        console.error('signin error', e);
        return res.status(500).render('register', { error: 'Server error during signin.' });
    }
});

app.post('/signout', (req, res) => {
    req.session.destroy(() => res.redirect('/signin'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
