const _ = require('lodash')
const isNumber = require('is-number');
const acsanitizer = require('ac-sanitizer')

const acaee = () => {
  
  // PRIVATE
  const indexOfCI = (arr, val) => {
    return _.toLower(_.find(arr, item => {
      if (_.toLower(item) === _.toLower(val)) return item
    }))
  }

  // field properties that can be string or object (if differs for different actions)
  const objFields = [{ docField: 'enumFor', property: 'enum' }]


  // PUBLIC
  /**
   * Returns the default object for a given model (and path/field)
   * @param params.field - the array of fields with field definitions from apiDoc
   * @param paams.field - the field to use
   * @param params.path - at the beginning identical to field. During process it shows the path to each field
   * @param params.defaultValue - during recursive calls it contains the whole object
   */
  const defaultValues = (params) => {
    const fields = _.get(params, 'fields')
    const field = _.get(params, 'field')
    const path = _.get(params, 'path', field)

    const fieldDef = _.find(fields, { field })
    const defaultValue = _.get(params, 'defaultValue', {})

    if (_.get(fieldDef, 'defaultsTo')) {
      _.set(defaultValue, path, _.get(fieldDef, 'defaultsTo'))     
    }
    if (_.get(fieldDef, 'properties')) {
      _.forEach(_.get(fieldDef, 'properties'), prop => {
        defaultValues({
          fields: _.get(fieldDef, 'properties'),
          field: prop.field,
          path: path + '.' + prop.field,
          defaultValue
        })
      })
    }
    return defaultValue
  }

  /**
   * Returns fields (as array) which are marked (e.g. deprecated)
   * 
   * @param params.fields - the field definitions for APIdoc
   * @param params.marker - optional marker to look for, defaults to "deprecated"
   * @param params.response - response array during process
   * @param params.path - path set during recursive process 
   */
  const markedFields = (params) => {
    const fields = _.get(params, 'fields')
    const marker = _.get(params, 'marker', 'deprecated')
    const response = _.get(params, 'response', [])
    const path = _.get(params, 'path')

    _.forEach(fields, field => {
      if (_.get(field, marker)) {
        response.push((path ? path + '.' : '') + field.field)
      }
      if (_.get(field, 'properties')) {
        markedFields({
          fields: field.properties,
          marker,
          response,
          path: (path ? path + '.' : '') + field.field
        })
      }
    })
    return response
  }

  const prepareDocumentation = (params) => {
    const controller = _.get(params, 'controller')
    const action = _.toLower(_.get(params, 'action'))
    const { method, path, iamPermissions, deprecated, beta, experimental } = _.get(params, 'route')
    const apiDoc = _.get(params, 'apiDoc')
    const name = _.get(params, 'route.name', action)
    const responseName = _.get(params, 'responseName')

    const def = _.get(apiDoc, controller)
    if (_.isEmpty(def)) return {}

    const headers = _.get(def, 'headers', _.get(apiDoc, 'headers'))
    const description = _.get(_.find(_.get(def, 'descriptions'), { action }),  'description')

    // filter by actions
    let requestFields = _.orderBy(_.filter(_.cloneDeep(_.get(def, 'fields')), field => {
      if (!_.get(field, 'actions')) return field
      if (indexOfCI(_.get(field, 'actions'), action)) return field
    }), 'field')
    if (!_.size(requestFields)) return false

    // filter by actions (default response, alternative response.ACTION)
    let responseFields = _.cloneDeep(_.get(def, 'fields'))
    let responseAction = 'response'
    let filteredFields = []

    if (responseName) {
      // Priority 1: Filter by responseName if it exists
      responseAction = 'response.' + responseName
      filteredFields = _.filter(responseFields, field => {
        return indexOfCI(_.get(field, 'actions'), responseAction)
      })
    }
    else {
      // Priority 2: Try filtering by response.action
      responseAction = 'response.' + action
      filteredFields = _.filter(responseFields, field => {
        return indexOfCI(_.get(field, 'actions'), responseAction)
      })
      
      // Priority 3: If no results with response.action, fall back to 'response'
      if (filteredFields.length === 0) {
        responseAction = 'response'
        filteredFields = _.filter(responseFields, field => {
          return indexOfCI(_.get(field, 'actions'), responseAction)
        })
      }
    }

    // Order the filtered results by field
    responseFields = _.orderBy(filteredFields, 'field')

    // filter out fields which are marked as noDocumentation = true
    requestFields = _.filter(requestFields, field => {
      if (!_.get(field, 'noDocumentation')) return field
    })
    responseFields = _.filter(responseFields, field => {
      if (!_.get(field, 'noDocumentation')) return field
    })


    const prepareFields = (fields, httpMethod) => {
      const fieldParameters = {
        request: ['field', 'type', 'required', 'description', 'location', 'properties', 'defaultsTo', 'enum', 'range','nullAllowed', 'deprecated', 'beta', 'experimental', 'retired'],
        response: ['field', 'type', 'description', 'properties', 'defaultsTo', 'enum', 'range', 'nullAllowed', 'deprecated', 'beta', 'experimental', 'retired']
      }
      
      const processFields = (fieldsToProcess) => {
        return _.map(fieldsToProcess, f => {
          // fields that can be an array (value differs for different actions) or strings, list see above
          _.forEach(objFields, objField => {
            // only convert if array
            let apiDocField = _.get(f, objField.docField)
            if (_.isArray(apiDocField)) {
              let item = _.find(apiDocField, { action })
              _.set(f, objField.property, _.get(item, 'value'))
            }
          })
          
          let required = _.find(f.requiredFor, { action })
          if (required) {
            if (_.get(required, 'condition')) {
              f.required = _.get(required, 'condition')
            }
            else {
              f.required = true
            }
          }
          else {
            f.required = false
          }
          
          let nullAllowed = _.find(f.nullAllowedFor, { action }) || _.find(f.nullAllowedFor, { action: httpMethod })
          if (nullAllowed) f.nullAllowed = true
          
          if (_.isArray(f.description)) {
            f.description = _.get((_.find(f.description, { action: httpMethod }) || _.find(f.description, { action })), 'message')
          }
          
          f.location = _.get(f, 'location', 'body')
          
          // DEPRECATED: Use a schema is deprecated, use properties array!
          if (f.schema && !_.isFunction(_.get(f, 'schema.verify'))) {
            let schemaDef = []
            _.forOwn(f.schema, (obj, key) => {
              let required = _.get(obj, 'required') || _.find(f.requiredFor, { action })
              if (required) {
                if (_.get(required, 'condition')) {
                  required = _.get(required, 'condition')
                }
                else {
                  required = true
                }
              }
              else {
                required = false
              }
              
              let def = {
                field: key,
                type: !_.get(obj, 'flat') ? 'object' : _.get(obj, 'allowedKeys[0].type'),
                required,
                description: _.get(obj, 'description')
              }
              
              if (!_.get(obj, 'flat')) {
                let properties = []
                _.forEach(_.get(obj, 'allowedKeys'), keys => {
                  let def = {
                    field: _.get(keys, 'key'),
                    required,
                    description: _.get(keys, 'description'),
                    type: _.get(keys, 'type'),
                    isMemberOf: _.get(keys, 'isMemberOf')
                  }
                  properties.push(def)
                })
                _.set(def, 'type', 'object')
                _.set(def, 'properties', properties)
              }
              
              schemaDef.push(def)
            })
            _.set(f, 'properties', schemaDef)
          }
          
          if (_.size(f.properties) > 0) {
            f.properties = processFields(f.properties)
          }
          
          return _.pick(f, _.get(fieldParameters, httpMethod))
        })
      }
      
      return processFields(fields)
    }

    const defExamples = _.cloneDeep(_.get(def, 'examples'))
    let examples = []
    // replace identifier
    _.forEach(defExamples, example => {
      if (!_.get(example, 'identifier') && _.get(example, 'action') === action) {
        if (_.get(example, 'response.identifier')) {
          let identifier = _.find(defExamples, { identifier: _.get(example, 'response.identifier') })
          let responsePayload = _.merge(_.cloneDeep(_.get(identifier, 'response')), _.get(example, 'response'))
          _.set(example, 'response', responsePayload)
          _.unset(example, 'identifier')
        }
        examples.push(example)  
      }
    })

    const documentation = {
      name,
      method,
      path,
      description,
      deprecated,
      beta,
      experimental,
      iamPermissions,
      headers,
      request: {
        fields: prepareFields(requestFields, 'request')
      },
      response: {
        type: _.get(def, 'response.' + action + '.type', 'object'),
        fields: prepareFields(responseFields, 'response')
      },
      examples
    }
    return documentation
  }


  /**
   * 
   * @param config OBJECT with the following properties
   * @param config.apiDoc OBJECT with field definitions
   * @param config.http.apiDoc OBJECT WITH properties apiPrefix (e.g. v1)
   * 
   * @param params.name STRING Name of your controller (e.g. user)
   * @param params.availableActions ARRAY Array of actions available the controller (e.g. find, create, etc)
   * @param params.routes ARRAY of routes for this controller. Each entry must be an object with at least method, path and action
   * 
   * EXAMPLE
   * params
   * {
   *   name: 'user', // name of the ACAPI controller without the word Controller - must match the controller name!
   *   path: 'xxx', // optional path if path for controller does not match controller name, e.g. Controller name: DownloadLogsController, but API path is just download (not downloadlogs)
   *   availableActions: ['find', 'create'],
   *   routes: [
   *    { method: 'get', path: '/v1/user', action: 'find' },
   *    { method: 'post', path: '/v1/user', action: 'create' }
   *   ]
   * }
   * 
   **/

  const apidocRoute = (config, params) => {
    const controllerName = _.get(params, 'name')
    const availableActions = _.get(params, 'availableActions')
    const routes = _.get(params, 'routes')


    const apiPrefix = _.get(config, 'http.apiDoc.apiPrefix')
    const path = `/${apiPrefix}/${_.toLower(_.get(params, 'path', controllerName))}/apidoc`
    let apiDocRoute = { 
      method: 'get', 
      path, 
      action: 'apiDoc',
      apiDoc: {
        enabled: false
      },
      sanitizer: true,
      policies: _.get(config, 'http.apiDoc.policies', true) 
    }
    const apiDoc = (req, res) => {
      const name = _.get(req.query, 'name')
      const response = []
      const responseName = _.get(req.query, 'responseName')
      _.forEach(availableActions, action => {
        let route = _.find(routes, { action })
        let routeName = _.get(route, 'name', _.get(route, 'action'))
        if (route && (!name || _.toLower(name) === _.toLower(routeName) || (_.toLower(name) === 'crud' && _.indexOf(['create', 'find', 'update', 'destroy'], routeName) > -1))) {
          let doc = prepareDocumentation({
            controller: controllerName,
            action,
            route,
            apiDoc: _.get(config, 'apiDoc'),
            responseName
          })
          if (doc) response.push(doc)  
        }
      })
      // Do not cache APIdocs
      if (_.isFunction(res.setHeader)) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      if (_.isFunction(res.json)) return res.json(response)
      // classic callback as fallback
      return res(null, response)
    }

    return { apiDocRoute, apiDoc }
  }

  const allParams = (req, res, next) => {
    const fields = ['params', 'query', 'body']

    const all = {}
    _.forEach(fields, field => {
      let obj = _.get(req, field)

      // if text/plain
      if (!_.isObject(obj) && _.startsWith(_.get(req, 'headers.content-type'), 'text/plain')) {
        try {
          obj = JSON.parse(obj)
        }
        catch(e) {
          console.error('%s | Middleware | Parsing body failed %j', e)
        }
      }

      for (let key in obj) {
        if (_.has(obj, key)) {
          let value =  _.get(obj, key)
          if (field !== 'body') {
            // query/params are strings even if the actual payload is a number
            if (isNumber(value)) {
              if (value % 1 !== 0) {
                value = parseFloat(value)
              }
              else {
                value = parseInt(value, 10)
              }
            }
          }
          _.set(all, key, value)
        }
      }
    })
    if (_.get(req.headers, 'x-admiralcloud-hash')) {
      // USED FOR SIGNED PAYLOADs - it will be unchanged from the original request, while allParams will be sanitized and enhanced with defaults
      const original = _.cloneDeep(all)
      req.allParamsOriginal = () => { return original }        
    }
    req.allParams = () => { return all }
    return next()
  }

  const mapFieldDefinition = (field, action, params) => {
    if (_.isArray(field.requiredFor)) {
      let r = _.find(field.requiredFor, { action })
      if (r?.condition) {
        let conditions = []
        if (_.isArray(r.condition)) conditions = r.condition
        else conditions.push(r.condition)
        let required = true
        for (let i = 0; i < _.size(conditions); i++) {
          const condition = conditions[i]
          if (_.get(condition, 'op') === 'not') {
            required = required && !_.get(params, _.get(condition, 'field'))
          }
          else if (_.get(condition, 'value')) {
            required = required && _.get(params, _.get(condition, 'field')) === _.get(condition, 'value')
          }
          else {
            required = required && _.get(condition, 'field')
          }
          if (!required) break
        }

        field.required = required
      }
      else if (r) {
        field.required = true
      }
      else field.required = false
      if (_.get(r, 'customErrorMessage')) {
        field.customErrorMessage = _.get(r, 'customErrorMessage')
      }
    }

    // fields that can be an array (value differs for different actions) or strings
    _.forEach(objFields, objField => {
      // only convert if array
      let apiDocField = _.get(field, objField.docField)
      if (_.isArray(apiDocField)) {
        let item = _.find(apiDocField, { action })
        _.set(field, objField.property, _.get(item, 'value'))
      }
    })

    // range can be set with variables (e.g. if you want a time frame)
    // if so, do not define range itself, but use rangeDef with properties type (timestamp) and deviation
    if (_.isPlainObject(field.rangeDef)) {
      let low = 0
      let high = 100
      if (_.get(field, 'rangeDef.type') === 'timestamp') {
        low = _.round(new Date().getTime()/1000) - _.get(field, 'rangeDef.deviation')
        high = _.round(new Date().getTime()/1000) + _.get(field, 'rangeDef.deviation')
      }
      field.range = [low, high]
    }

    // check and set defaultsTo
    if (_.has(field, 'defaultsTo') && !_.has(params, field.field)) {
      _.set(params, field.field, _.get(field, 'defaultsTo'))
    }

    if (_.get(field, 'properties')) {
      // filter properties by actions (if actions is set)
      field.properties = _.filter(field.properties, prop => {
        if (!_.get(prop, 'actions') || _.get(prop, 'actions').includes(action)) return field
      })

      field.properties = _.map(field.properties, prop => {
        return mapFieldDefinition(prop, action, params)
      })
    }
    return field
  }

  const sanitizer = (config, route, req, res, next) => {
    if (!_.get(config, 'apiDoc')) return next()
    if (_.has(route, 'sanitizer')) return next() // route based sanitizer is activated

    const controller = _.get(req, 'options.controller') || _.get(route, 'controller')
    const action = _.get(req, 'options.action') || _.get(route, 'action')

    const def = _.get(config.apiDoc, controller)
    if (_.isEmpty(def)) return next()

    let params = req.allParams()
    const checkPayload = _.get(params, 'checkPayload')

    let fields = _.cloneDeep(_.get(def, 'fields'))
    // Process fields and their nested properties
    fields = processFields(fields, action, params)
    if (!_.size(fields)) return next()

    const fieldsToCheck = {
      params,
      fields,
      omitFields: _.get(config, 'http.sanitizer.omitFields'),
      ignoreUnknownFields: _.get(route, 'ignoreUnknownFields'),
      adminLevel: _.get(res.locals, 'user.adminLevel') || _.get(req.user, 'adminLevel') || 0
    }
    const check = acsanitizer.checkAndSanitizeValues(fieldsToCheck)
    if (_.get(check, 'error')) return res.miscError(_.get(check, 'error'))
    else params = _.get(check, 'params')

    if (_.get(config, 'environment') === 'test' && checkPayload) {
      return res.json(params)  
    }
    
    req.allParams = () => { return params }
    return next()
  }

  // Function to process fields recursively
  const processFields = (fields, action, params) => {
    if (!fields || !_.isArray(fields)) return []
    
    // Filter by actions
    let processedFields = _.filter(fields, field => {
      if (!_.get(field, 'actions')) return true
      return _.get(field, 'actions').includes(action)
    })
    
    // Filter httpMethods
    processedFields = _.filter(processedFields, field => {
      if (!_.get(field, 'httpMethods')) return true
      return _.get(field, 'httpMethods').includes('request')
    })
    
    // Map required and process nested properties
    processedFields = _.map(processedFields, field => {
      // Apply the required mapping
      field = mapFieldDefinition(field, action, params)
      
      // Process nested properties if they exist
      if (_.has(field, 'properties') && _.isArray(field.properties)) {
        field.properties = processFields(field.properties, action, params)
      }
      
      return field
    })
    
    return processedFields
  }

    /**
   * Return entry for sanitizer for a given field (and controller/action)
   */
  const fieldDefinition = (config, field, controller, action) => {
    const def = _.get(config.apiDoc, controller)
    if (!def) return { message: 'noAPIdoc', additionalInfo: { controller, action } }
    let fields = _.cloneDeep(_.get(def, 'fields'))
    let fieldToUse = _.find(fields, f => {
      if (_.indexOf(_.get(f, 'actions'), action) > -1 && _.get(f, 'field') === field) return f
    })
    return mapFieldDefinition(fieldToUse, action)
  }

  return {
    defaultValues,
    markedFields,
    prepareDocumentation,
    apidocRoute,
    allParams,
    mapFieldDefinition,
    sanitizer,
    fieldDefinition
  }
}

module.exports = acaee()

