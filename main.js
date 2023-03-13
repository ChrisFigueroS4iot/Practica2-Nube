const express = require('express');
const session = require('express-session');
const fs = require('fs');
const { DynamoDBClient, CreateTableCommand,PutItemCommand,ScanCommand,GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand,CreateBucketCommand,PutBucketAclCommand  } = require('@aws-sdk/client-s3');

const app = express();
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: true
}));


const REGION = 'us-east-1';

//Crear S3 BUCKET
const s3 = new S3Client({ region: REGION });

const createBucketParams = {
  Bucket: 'products-bucket-practica2-2023'
};

const command = new CreateBucketCommand(createBucketParams);

s3.send(command)
  .then((data) => {
    console.log(`Bucket created successfully: ${data.Location}`);
    // Permisos de leer
    const aclParams = {
      Bucket: createBucketParams.Bucket,
      ACL: "public-read"
    };
     const putBucketAclCommand = new PutBucketAclCommand(aclParams);
     return s3.send(putBucketAclCommand);

  }).then((data) => {
    console.log("Bucket ACL updated successfully to allow public read access");
  })
  .catch((error) => {
    console.error(error);
  });



//Crear tabla DYNAMO DB
const client = new DynamoDBClient({ region: REGION });

const params = {
  AttributeDefinitions: [
    { AttributeName: 'id', AttributeType: 'N' }
  ],
  KeySchema: [
    { AttributeName: 'id', KeyType: 'HASH' }
  ],
  TableName: 'Products',
  BillingMode: 'PAY_PER_REQUEST'
};

async function createTable() {
  try {
    const command = new CreateTableCommand(params);
    const response = await client.send(command);
    console.log(`Table created successfully: ${response.TableDescription.TableName}`);
  } catch (error) {
    console.error(error);
  }
}

createTable();

const items =[
  {
    id: { N: "1" },
    name: { S: "Product 1" },
    price: { N: "10.0" },
    image: { S:'https://s3.us-east-1.amazonaws.com/products-bucket-practica2-2023/IMAGES/image1.jpg'}
  },
  {
    id: { N: "2" },
    name: { S: "Product 2" },
    price: { N: "20.0" },
    image: { S:'https://s3.us-east-1.amazonaws.com/products-bucket-practica2-2023/IMAGES/image2.jpg'}
  },
  {
    id: { N: "3" },
    name: { S: "Product 3" },
    price: { N: "30.0" },
    image: { S:'https://s3.us-east-1.amazonaws.com/products-bucket-practica2-2023/IMAGES/image3.jpg'}
  }
]


function uploadPictureToS3(filename,keyname){
  const uploadParams = {
    Bucket: 'products-bucket-practica2-2023',
    Key: keyname,
    Body: fs.readFileSync(filename),
    ContentType: 'image/jpeg',
    ACL: 'public-read'
  }
  const command = new PutObjectCommand(uploadParams);

  return new Promise((resolve, reject) => {
    s3.send(command)
      .then(data => {
        const location = `https://s3.${REGION}.amazonaws.com/${uploadParams.Bucket}/${uploadParams.Key}`;
        console.log("Object uploaded successfully to:", location);
        resolve(location);
      })
      .catch(err => {
        console.log('Error', err);
        reject(err);
      });
  })

}

uploadPictureToS3('assets/image1.jpg','IMAGES/image1.jpg');
uploadPictureToS3('assets/image2.jpg','IMAGES/image2.jpg');
uploadPictureToS3('assets/image3.jpg','IMAGES/image3.jpg');





//Crear los items en DYNAMO DB
async function insertItemsIntoDynamoDB(items) {
  for (let item in items){
    console.log(item)
    const command = new PutItemCommand({
      TableName: "Products",
      Item: item
    });
    try {
      const result = await client.send(command);
      console.log("Registro insertado con éxito:", result);
    } catch (err) {
      console.error("Error al insertar registro:", err);
    }
    }
  }

  insertItemsIntoDynamoDB(items);
 


app.get('/', async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: "Products"
    });

    let { Items: products } = await client.send(command);

    products = products.map(item => ({
      id: parseInt(item.id.N),
      name: item.name.S,
      price: parseFloat(item.price.N),
      image: item.image.S
    }));
    res.render('index', { products, cart: req.session.cart || [] });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});


 

app.post('/add-to-cart', async (req, res) => {
  console.log(req.body);
  const productId = req.body.productId;
  const params = {
    TableName: 'Products',
    Key: {
      id: { N: productId },
    },
  };
  try {
    const data = await client.send(new GetItemCommand(params));
    if (!data.Item) {
      res.sendStatus(404);
      return;
    }
    if (!req.session.cart) {
      req.session.cart = [];
    } 
    Item = {
      id: parseInt(data.Item.id.N),
      name: data.Item.name.S,
      price: parseInt(data.Item.price.N),
      image: data.Item.image.S  
    };

    req.session.cart.push(Item);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});
  
  


function normalizePort(val) {
    var port = parseInt(val, 10);
  
    if (isNaN(port)) {
      // named pipe
      return val;
    }
  
    if (port >= 0) {
      // port number
      return port;
    }
  
    return false;
} 

var port = normalizePort(process.env.PORT || '3000');
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});