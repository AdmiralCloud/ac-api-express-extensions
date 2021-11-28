# AC API Express Extensions
This packages adds 3 valuable helper function to your express app:
+ "allParams" middleware which adds query, path and (JSON) body parameters into one single property of the request object
+ "sanitizer" which adds sanitizing to your route based on defined fields
+ "apidocRoute" which "automatically" creates your API documentation based on defined fields (the same as for sanitizing)

## General Usage
```
yarn add ac-api-express-extensions
const acaee = require('acaee)

// as middleware
const app = express()

app.get('/v1/user', [acaee.allParams, acaee.sanitizer], (req, res) => {
  const params = req.allParams()
  // DO YOUR THING
})
```

## allParams
Provides a single property of all available parameters (from query, path and JSON body).

```
const params = req.allParams()
```

## sanitizer
Use a field definition to make sure only pre-defined data is allowed in your API. We use ac-sanitizer to provide sanitizing of the incoming data.

```
// your field definitions, e.g. for your user controller and the action find
const apiDoc = {
  user: {
    fields: [
      {
        actions: ["find"],
        field: "lastname",
        type: "string",
        description: [
          {
            action: "find",
            message: "Lastname of the user your want to find"
          }
        ]
      }
    ]
  }
}

// route is usually an empty object. If you want to use a custom sanitizer you can 
// define the sanitizing function in the route object
//
// Additionally you can add controller and action to the route object 
// if you are not using req.option - please see ATTENTIOn section below.
const route = {}

const middleware = [acaee.allParams, sanitizer.bind(this, { apiDoc }, route)]

const app = express()

app.get('/v1/user', middleware, (req, res) => {
  const params = req.allParams() // this is now sanitized
  // DO YOUR THING
})

// EXAMPLE
GET /v1/user?firstname=tom&lastname=dooley
// -> req.allParams() = { lastname: dooley }
```

### Usage in testmode
You can use sanitizer in testmode to only check the payload and the result. If you add checkPayload=true to your request and you are in testmode (NODE_ENV=test) the payload will be checked and either return an error or returns the sanitized payload. The process then ends here, no further (middleware) actions are called.

**ATTENTION**   
Please keep in mind, that this sanitizer required allParams, so make sure to have it in your express middleware array BEFORE the sanitizer. 

Additionally, the sanitizer requires the controller and action name in order to determine the proper field definition in your apiDoc configuration object. Make sure to provide them as req.options.controller and req.options.action or put them in your route object for the sanitizer.

## apidocRoute
This function adds a route/endpoint /apidoc to your controller and provides an API documentation object as response. 

API documentation is based on the same field definitions as your sanitizer. 

```
// your field definitions, e.g. for your user controller and the action find
const apiDoc = {
  user: {
    fields: [
      {
        actions: ["find"],
        field: "lastname",
        type: "string",
        description: [
          {
            action: "find",
            message: "Lastname of the user your want to find"
          }
        ]
      }
    ]
  }
}

const app = express()

app.get('/v1/user', middleware, (req, res) => {
  const params = req.allParams() // this is now sanitized
  // DO YOUR THING
})

let aconfig = {
  http: {
    apiDoc: {
      apiPrefix: 'v5'
    }
  },
  apiDoc // from above
}

let aparams = { 
  name: 'find', 
  availableActions: ['find'],
  routes: [{ method: 'get', path: '/v1/user, action: 'find' }]
}

const { apiDocRoute, apiDoc} = acaee.apidocRoute(aconfig, aparams)
app.express.get(apiDocRoute.path, expressMiddleWare, apiDoc) 
// apiDocRoute contains some information regarding this route
// apiDoc is the actually function (req, res) that is called by express

// EXAMPLE
GET /v1/user/apidoc
[{
  "name": user.find",
  "method": "get",
  "path": "/v1/user",
  request: {
    fields: [{ // field definition }]
  }
}]

```

## defaultValues
Use this function to get the default values for a given object (in APIdoc)

```
const def = {
  fields: [{
    field: 'field1',
    type: 'string'
    ...
  }, {
    field: 'field2',
    type: 'object',
    properties: [{
      field: 'prop1',
      type: 'string,
      defaultsTo: 'Prop1 default value'
    }]
  }]
}

const defaultObject = acaee.defaultValues({
  fields: def.fields,
  field: 'field2'
})

// response
{
  field2: {
    prop1: 'Prop1 default value'
  }
}
```

## fetch marked fields
Use this function to get a list of fields with special markers (e.g. deprecation markers)

```
const def = {
  fields: [{
    field: 'field1',
    type: 'string'
    deprecated: true
  }, {
    field: 'field2',
    type: 'object',
    properties: [{
      field: 'prop1',
      type: 'string,
      deprecated: true
    }]
  }]
}

const defaultObject = acaee.markedFields({
  fields: def.fields
})

// response
['field1', 'field2.prop1']
```