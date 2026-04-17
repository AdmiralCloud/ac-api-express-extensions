# AC API Express Extensions
This packages adds 3 valuable helper function to your express app:
+ "allParams" middleware which adds query, path and (JSON) body parameters into one single property of the request object
+ "sanitizer" which adds sanitizing to your route based on defined fields
+ "apidocRoute" which "automatically" creates your API documentation based on defined fields (the same as for sanitizing)

[![Node.js CI](https://github.com/AdmiralCloud/ac-api-express-extensions/actions/workflows/node.js.yml/badge.svg)](https://github.com/AdmiralCloud/ac-api-express-extensions/actions/workflows/node.js.yml) [![CodeQL](https://github.com/AdmiralCloud/ac-api-express-extensions/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/AdmiralCloud/ac-api-express-extensions/actions/workflows/github-code-scanning/codeql)

## General Usage
```
yarn add ac-api-express-extensions
const acaee = require('ac-api-express-extensions')

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

Query and path parameters that look like numbers are automatically cast to `integer` or `float`.

If the request contains the header `x-admiralcloud-hash` (signed payloads), an additional `req.allParamsOriginal()` function is attached. It returns a snapshot of the merged, number-cast parameters taken before the sanitizer runs and before any defaults are applied — useful for verifying signed payloads against the exact values that were used to compute the signature.

```
const original = req.allParamsOriginal()
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
// if you are not using req.option - please see ATTENTION section below.
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

### Config options for sanitizer
| Option | Type | Description |
|---|---|---|
| `config.http.sanitizer.omitFields` | array | List of fields that are globally excluded from sanitizing |

### Usage in testmode
You can use sanitizer in testmode to only check the payload and the result. If you add checkPayload=true to your request and you are in testmode (NODE_ENV=test) the payload will be checked and either return an error or returns the sanitized payload. The process then ends here, no further (middleware) actions are called.

**ATTENTION**   
Please keep in mind, that this sanitizer requires allParams, so make sure to have it in your express middleware array BEFORE the sanitizer. 

Additionally, the sanitizer requires the controller and action name in order to determine the proper field definition in your apiDoc configuration object. Make sure to provide them as req.options.controller and req.options.action or put them in your route object for the sanitizer.

The sanitizer reads the current user's `adminLevel` from `res.locals.user.adminLevel` or `req.user.adminLevel` (defaults to `0`) and forwards it to ac-sanitizer.

## Documentation of fields/features
The APIDoc is automatically generated from the field definitions used for validating and sanitizing API requests. This ensures that the documentation always matches the current code state.

### Route configuration
You can configure the way APIdocs are created on per-route basis.

#### Available options
|Property|Type|Description|
|---|---|---|
|deprecated|boolean|If true, the route is marked as deprecated|
|beta|boolean|If true, the route is marked as beta|
|experimental|boolean|If true, the route is marked as experimental|
|apiDoc|object|Optional APIdoc options|
|apiDoc.enabled|boolean|If set to false, this endpoint will not be documented|
|apiDoc.apiPrefix|string|API prefix used when building the apidoc route path|
|name|string|Optional name for this route, defaults to action|
|iamPermissions|array|Array of required iamPermissions for this endpoint/action|
|ignoreUnknownFields|boolean|If true, unknown fields in the request are silently ignored instead of rejected|

##### apiDoc options
These values are optional and will default to API's config.http.apiDoc fields


### Available fields/properties
|Property|Type|Description|
|---|---|---|
|actions|array|List of actions for which this field is relevant*|
|**field**|string|Name of the field (required)|
|type|string|Data type of the field - see [Available types](#available-types) below|
|description|string/array|Description of the field. Can be a string or an array with action-specific descriptions*|
|requiredFor|array|Actions the field is required for. Can have additional conditions|
|nullAllowed|boolean|If true, the field can be null for all actions|
|nullAllowedFor|array|Action-specific null permission, e.g. `[{ action: 'update' }]`. Also accepts the HTTP method.|
|enum|array|List of allowed values|
|enumFor|array|Action-specific allowed values, e.g. `[{ action: 'find', value: ['a', 'b'] }]`|
|range|array|Range of values [min, max]|
|rangeDef|object|Dynamic range definition. Set `type: 'timestamp'` and `deviation` (seconds) to compute a time-based range at request time instead of using a fixed `range`|
|defaultsTo|any|Default value applied to the field if it is not present in the request|
|properties|array|For objects: list of nested field definitions.|
|httpMethods|array|Restricts the field to specific HTTP methods (e.g. `['request']`). If omitted the field is used for all methods.|
|location|string|Where the field is expected (`body`, `query`, `params`). Defaults to `body`.|
|noDocumentation|boolean|If true, this field is not shown in APIdoc|
|deprecated|string|If set, this field is marked as deprecated with this message|
|beta|boolean|If true, this field is marked as beta|
|experimental|boolean|If true, this field is marked as experimental|
|retired|boolean|If true, this field is marked as retired|
|optional|boolean|For response fields: marks the field as optional in the response|
|iamPermissions|array|Additional IAM permissions required to see this field (beyond the endpoint-level permission). Rendered as inline badges in APIdoc.|


### Available types

Primitive types:

| Type | Description |
|---|---|
| `string` | Any string. Optional: `minLength`, `maxLength` |
| `integer` | Whole number (32-bit unsigned by default). Set `subtype: 'signed'` for negative values |
| `long` | 64-bit integer |
| `short` | 16-bit integer |
| `float` | Floating-point number |
| `boolean` | `true` or `false` |

Complex types:

| Type | Description |
|---|---|
| `array` | Array. Optional: `valueType` (type of each element), `minSize`, `maxSize`, `unique` |
| `object` | Plain object. Use `properties` to define nested fields. Set `strict: true` to reject unknown keys |
| `arrayOfObjects` | Convention for documentation only — use `array` with `properties` for sanitizing |

Special/format types:

| Type | Description |
|---|---|
| `date` | Date or datetime string. Optional: `dateFormat` (e.g. `YYYY-MM-DD`) |
| `email` | Valid email address |
| `url` | Valid URL. Optional: `protocols` (default `['http','https']`), `require_tld`, `require_protocol` |
| `fqdn` | Fully qualified domain name. Optional: `wildcardAllowed` |
| `uuid` | UUID string. Optional: `uuidVersion` (default `4`) |
| `ip` | IP address (v4 or v6). Optional: `version`, `anonymize` |
| `cidr` | CIDR notation or array of CIDR objects |
| `base64` | Base64 string. Set `convert: true` to decode the value |
| `hexColor` | Hex color string (e.g. `#ff0000`) |
| `rgb` | RGB color string (e.g. `10,100,255` or `rgb(10,100,255)`) |
| `gps` | Comma-separated `lat,lng` or `lat,lng,distance` |
| `ratio` | Ratio string in `NUMBER:NUMBER` format |
| `hashids` | Hashids-encoded string — decoded to array on input |
| `countryCode` | ISO 3166-1 alpha-2 country code |
| `fileExtension` | Valid file extension (without leading dot) |
| `iso-639` | ISO 639 language code (tries 639-2, falls back to 639-1). Optional: `convert` |
| `iso-639-1` | ISO 639-1 two-letter language code |
| `iso-639-2` | ISO 639-2 three-letter language code |

Union types (resolved at runtime):

| Type | Description |
|---|---|
| `integer \| string` | Accepts either an integer or a string |
| `integer \| boolean` | Accepts either an integer or a boolean |

Special `enum` shortcuts (pass as string instead of array):

| Value | Description |
|---|---|
| `'iso-639-1'` | All valid ISO 639-1 codes |
| `'iso-639-2'` | All valid ISO 639-2 codes |
| `'countrylist'` | All country names from ac-countrylist |

### Details on certain fields
#### Actions
Make sure that response uses either just "response" or "response.action"
```
//Endpoint /deactivateMFA

actions: ['deactivatemfa', 'response.deactivatemfa']
```
The response properties will not be displayed in APIdoc, if the naming is not correct!

#### String/Array types
All string/array types work like this:
* if you use a string, the value will be used for all actions
* if you use an array, every action will use the related entry in array

#### Conditions on requiredFor fields
`condition` can be a single condition object or an array of condition objects (all must be true).

```js
// NOT: required if 'otherId' is falsy
{ action: 'find', condition: { op: 'not', field: 'otherId' } }

// EQUALS: required if 'type' equals 'advanced'
{ action: 'find', condition: { field: 'type', value: 'advanced' } }

// INCLUDE: required if 'type' is one of the given values
{ action: 'find', condition: { op: 'include', field: 'type', value: ['advanced', 'expert'] } }

// TRUTHY: required if 'featureFlag' is set and truthy
{ action: 'find', condition: { field: 'featureFlag' } }

// MULTIPLE conditions (all must be true - AND logic)
{ action: 'find', condition: [{ op: 'not', field: 'fromLogs.enabled' }, { op: 'not', field: 's3.enabled' }] }
```

#### Endpoints with no request parameters
If you have an endpoint with no request parameters, you have to use a placeholder - otherwise the endpoint/action will not show in APIDoc.

```
// EXAMPLE
{
  actions: ['find'],
  field: '-',
  description: 'This endpoint does not require or accept any request parameters'
}
```

#### Object Properties
Use properties array to define nested object properties. You can use the same properties as for root properties.

### apiDoc object structure
Beyond the `fields` array the controller definition object supports additional top-level properties:

| Property | Type | Description |
|---|---|---|
| fields | array | Field definitions (see above) |
| descriptions | array | Action-specific endpoint descriptions, e.g. `[{ action: 'find', description: 'Find a user' }]` |
| headers | array | Headers that apply to all routes of this controller |
| examples | array | Example request/response pairs. Each entry should include `action` and optionally `response`. An entry with `identifier` acts as a reusable base object that other examples can reference via `response.identifier`. |
| response | object | Response type per action, e.g. `{ find: { type: 'array' } }`. Defaults to `'object'`. |

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
  routes: [{ method: 'get', path: '/v1/user', action: 'find' }]
}

const { apiDocRoute, apiDoc} = acaee.apidocRoute(aconfig, aparams)
app.express.get(apiDocRoute.path, expressMiddleWare, apiDoc) 
// apiDocRoute contains some information regarding this route
// apiDoc is the actually function (req, res) that is called by express

// EXAMPLE
GET /v1/user/apidoc
[{
  "name": "user.find",
  "method": "get",
  "path": "/v1/user",
  request: {
    fields: [{ // field definition }]
  }
}]

```

### Query parameters for the /apidoc endpoint
| Parameter | Description |
|---|---|
| `name` | Filter documentation to a specific action by name. Use `crud` as a shortcut to return only `create`, `find`, `update` and `destroy`. |
| `responseName` | Override which response action is used to select response fields (e.g. `responseName=myCustomResponse`). |

## prepareDocumentation
Builds a single documentation object for one controller/action/route combination. This is the function called internally by `apidocRoute` for each action. You can call it directly if you need programmatic access to the documentation without setting up an HTTP route.

```
const doc = acaee.prepareDocumentation({
  controller: 'user',       // key in the apiDoc object
  action: 'find',
  route: { method: 'get', path: '/v1/user' },
  apiDoc: config.apiDoc,
  responseName: undefined   // optional override for response field selection
})
```

Returns a documentation object `{ name, method, path, description, deprecated, beta, experimental, iamPermissions, headers, request, response, examples }` or `false` if no matching fields were found.

## mapFieldDefinition
Resolves all action-dependent properties of a single field definition (required state, enum, range, defaultsTo, etc.) for a given action and current params object. Called internally by the sanitizer and `prepareDocumentation`.

```
const resolvedField = acaee.mapFieldDefinition(fieldDef, action, params)
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
      type: 'string',
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
    type: 'string',
    deprecated: true
  }, {
    field: 'field2',
    type: 'object',
    properties: [{
      field: 'prop1',
      type: 'string',
      deprecated: true
    }]
  }]
}

const markedList = acaee.markedFields({
  fields: def.fields,
  marker: 'deprecated' // optional, defaults to 'deprecated'
})

// response
['field1', 'field2.prop1']
```

The `marker` parameter can be set to any boolean field property (e.g. `'beta'`, `'experimental'`, `'retired'`) to retrieve fields carrying that marker.

## fieldDefinition
Return the definition for a given field, controller and action. 

```
// Example use in an internal function

let field = acapi.helpers.fieldDefinition(acapi.config, 'fieldname', 'controller', 'action')
const fieldsToCheck = {
  params: { fieldname: ['metadata', 'tags', 'auto'] },
  fields: [
    field
  ]
}
let check = sanitizer.checkAndSanitizeValues(fieldsToCheck)
```
