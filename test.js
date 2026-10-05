const { expect } = require('chai')


const _ = require('lodash')
const acaee = require('./index')

const config = {
  http: {
    apiDoc: {
      apiPrefix: 'v1'
    }
  },
  apiDoc: {
    user: {
      fields: [
        {
          actions: ["find"],
          field: "lastname",
          type: "string",
          description: [
            {
              action: "find",
              message: "Lastname of the user",
            }
          ]
        }
      ]
    },
    mediaRepair: {
      fields: [
        {
          actions: ["retranscodemedia"],
          field: "ids",
          type: "array",
          valueType: "integer",
          description: "list of ids",
          requiredFor: [
            {
              action: 'retranscodemedia', condition: [
                { field: 'fromLogs.enabled', op: 'not' },
                { field: 's3.enabled', op: 'not' }
              ]
            },
          ]
        },
        {
          actions: ["retranscodemedia"],
          field: "fromLogs",
          type: "object",
          properties: [
            {
              field: 'enabled',
              type: 'boolean',
              description: 'Enable query from transcoder_logs table'
            }
          ]
        },
        {
          actions: ["retranscodemedia"],
          field: "s3",
          type: "object",
          properties: [
            {
              field: 'enabled',
              type: 'boolean',
              description: 'Use query from S3 bucket'
            }
          ]
        }
      ]
    }
  }
}

describe('All Params', () => {
  it('Check request parameters', done => {
    let req = {
      query: { id: 1 },
      params: { action: 'user' },
      body: { lastname: 'dooley' }
    }

    acaee.allParams(req, {}, () => {
      const params = req.allParams()
      expect(params.id).to.eql(req.query.id)
      expect(params.action).to.eql(req.params.action)
      expect(params.lastname).to.eql(req.body.lastname)
      return done()
    })
  })
})

describe('Sanitizing', () => {
  it('Check that only lastname is allowed', done => {
    let req = {
      query: { id: 1 },
      params: { action: 'user' },
      body: { lastname: 'dooley' }
    }

    acaee.allParams(req, {}, () => {
      acaee.sanitizer(config, { controller: 'user', action: 'find' }, req, {}, () => {
        const params = req.allParams()
        expect(params).to.eql({ lastname: 'dooley' })
        return done()
      })
    })
  })
})

describe('Sanitizing with iamPermissions', () => {
  const iamConfig = {
    http: config.http,
    apiDoc: {
      user: {
        fields: [
          {
            actions: ['find'],
            field: 'id',
            type: 'integer',
            description: 'User ID'
          },
          {
            actions: ['find'],
            field: 'internalScore',
            type: 'integer',
            description: 'Internal score',
            iamPermissions: ['user.internalData']
          }
        ]
      }
    }
  }

  it('Field with iamPermissions - user has matching permission in res.locals.iam -> field is included', done => {
    const req = { query: {}, params: {}, body: { id: 1, internalScore: 42 } }
    const res = { locals: { iam: [{ action: 'user.internalData', allow: true }, { action: 'user.read', allow: true }] } }

    acaee.allParams(req, res, () => {
      acaee.sanitizer(iamConfig, { controller: 'user', action: 'find' }, req, res, () => {
        const params = req.allParams()
        expect(params.internalScore).to.equal(42)
        return done()
      })
    })
  })

  it('Field with iamPermissions - user lacks permission -> error returned', done => {
    const req = { query: {}, params: {}, body: { id: 1, internalScore: 42 } }
    const res = {
      locals: { iam: [{ action: 'user.read', allow: true }] },
      miscError: (error) => {
        expect(error.message).to.equal('internalScore_iamPermissionNotSufficient')
        return done()
      }
    }

    acaee.allParams(req, res, () => {
      acaee.sanitizer(iamConfig, { controller: 'user', action: 'find' }, req, res, () => {
        done('shouldNotSucceed')
      })
    })
  })

  it('Field with iamPermissions - res.locals.iam absent -> check is skipped, field is included', done => {
    const req = { query: {}, params: {}, body: { id: 1, internalScore: 42 } }
    const res = { locals: {} }

    acaee.allParams(req, res, () => {
      acaee.sanitizer(iamConfig, { controller: 'user', action: 'find' }, req, res, () => {
        const params = req.allParams()
        expect(params.internalScore).to.equal(42)
        return done()
      })
    })
  })
})

describe('filterResponseByPermissions', () => {
  const responseConfig = {
    apiDoc: {
      message: {
        fields: [
          { actions: ['response.findlogs'], field: 'subject' },
          { actions: ['response.findlogs'], field: 'text', iamPermissions: ['customer.manageComplianceSettings'] },
          {
            actions: ['response.findlogs'],
            field: 'nested',
            properties: [
              { field: 'visible' },
              { field: 'hidden', iamPermissions: ['customer.manageComplianceSettings'] }
            ]
          }
        ]
      }
    }
  }

  it('strips a field with iamPermissions when the caller lacks the permission', () => {
    const body = { subject: 'hi', text: 'secret content' }
    const result = acaee.filterResponseByPermissions({ config: responseConfig, controller: 'message', action: 'findlogs', body, userPermissions: ['contact.find'] })
    expect(result).to.eql({ subject: 'hi' })
  })

  it('keeps a field with iamPermissions when the caller has a matching permission', () => {
    const body = { subject: 'hi', text: 'secret content' }
    const result = acaee.filterResponseByPermissions({ config: responseConfig, controller: 'message', action: 'findlogs', body, userPermissions: ['customer.manageComplianceSettings'] })
    expect(result).to.eql(body)
  })

  it('filters an array of response objects item by item', () => {
    const body = [{ subject: 'a', text: 'secret a' }, { subject: 'b', text: 'secret b' }]
    const result = acaee.filterResponseByPermissions({ config: responseConfig, controller: 'message', action: 'findlogs', body, userPermissions: [] })
    expect(result).to.eql([{ subject: 'a' }, { subject: 'b' }])
  })

  it('recurses into nested properties and strips only the restricted nested field', () => {
    const body = { subject: 'hi', nested: { visible: 1, hidden: 2 } }
    const result = acaee.filterResponseByPermissions({ config: responseConfig, controller: 'message', action: 'findlogs', body, userPermissions: [] })
    expect(result).to.eql({ subject: 'hi', nested: { visible: 1 } })
  })

  it('keeps a field without iamPermissions regardless of userPermissions', () => {
    const body = { subject: 'hi' }
    const result = acaee.filterResponseByPermissions({ config: responseConfig, controller: 'message', action: 'findlogs', body, userPermissions: [] })
    expect(result).to.eql({ subject: 'hi' })
  })

  it('returns the body unchanged if no APIdoc definition exists for the controller', () => {
    const body = { subject: 'hi', text: 'secret content' }
    const result = acaee.filterResponseByPermissions({ config: { apiDoc: {} }, controller: 'message', action: 'findlogs', body, userPermissions: [] })
    expect(result).to.eql(body)
  })
})

describe('Multi-Conditions', () => {
  const req = {
    query: { id: 1 },
    params: { action: 'retranscodemedia' },
    body: {
      ids: [1, 2],
      fromLogs: { enabled: false },
      s3: { enabled: false },
    }
  }

  it('Check ids present - should succeed', done => {
    acaee.allParams(req, {}, () => {
      acaee.sanitizer(config, { controller: 'mediaRepair', action: 'retranscodemedia' }, req, {}, () => {
        const params = req.allParams()
        expect(params).to.eql(req.body)
        return done()
      })
    })
  })

  it('Check ids removed - should fail', done => {
    _.unset(req, 'body.ids')
    const res = {
      miscError: (error) => {
        expect(error).to.eql({ message: 'field_ids_required' })
        return done()
      }
    }
    acaee.allParams(req, {}, () => {
      acaee.sanitizer(config, { controller: 'mediaRepair', action: 'retranscodemedia' }, req, res, () => {
        done('shouldNotSucceed')
      })
    })
  })

  it('enabled fromLogs - should succeed', done => {
    _.set(req, 'body.fromLogs.enabled', true)
    acaee.allParams(req, {}, () => {
      acaee.sanitizer(config, { controller: 'mediaRepair', action: 'retranscodemedia' }, req, {}, () => {
        const params = req.allParams()
        expect(params).to.eql(req.body)
        return done()
      })
    })
  })

  it('disabled fromLogs, enabled s3 - should succeed', done => {
    _.set(req, 'body.fromLogs.enabled', false)
    _.set(req, 'body.s3.enabled', true)
    acaee.allParams(req, {}, () => {
      acaee.sanitizer(config, { controller: 'mediaRepair', action: 'retranscodemedia' }, req, {}, () => {
        const params = req.allParams()
        expect(params).to.eql(req.body)
        return done()
      })
    })
  })

  it('disabled fromLogs, disabled s3 - should fail', done => {
    _.set(req, 'body.fromLogs.enabled', false)
    _.set(req, 'body.s3.enabled', false)
    const res = {
      miscError: (error) => {
        expect(error).to.eql({ message: 'field_ids_required' })
        return done()
      }
    }
    acaee.allParams(req, {}, () => {
      acaee.sanitizer(config, { controller: 'mediaRepair', action: 'retranscodemedia' }, req, res, () => {
        done('shouldNotSucceed')
      })
    })
  })
})

describe('APIdoc', () => {
  it('Check that apidoc is generated', done => {

    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find', name: 'Find user' }]
    }

    const { apiDocRoute, apiDoc } = acaee.apidocRoute(config, params)
    expect(apiDocRoute.method).to.eql('get')
    expect(apiDocRoute.path).to.eql('/v1/user/apidoc')
    expect(apiDocRoute.action).to.eql('apiDoc')
    expect(apiDocRoute.sanitizer).to.eql(true)
    expect(apiDocRoute.policies).to.eql(true)
    expect(apiDocRoute.apiDoc.enabled).to.eql(false)

    apiDoc({}, (err, result) => {
      if (err) return done(err)
      let doc = _.first(result)
      expect(doc.name).to.eql(params.routes[0].name)
      expect(doc.method).to.eql('get')
      expect(doc.path).to.eql(params.routes[0].path)

      const field = _.get(doc, 'request.fields[0]')
      expect(field.field).to.eql('lastname')
      expect(field.type).to.eql('string')
      expect(field.required).to.eql(false)
      expect(field.description).to.eql('Lastname of the user')
      expect(field.location).to.eql('body')
      return done()
    })
  })

  it('Check that route with apiDoc.enabled=false is excluded', done => {
    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find', name: 'Find user', apiDoc: { enabled: false } }]
    }

    const { apiDoc } = acaee.apidocRoute(config, params)

    apiDoc({}, (err, result) => {
      if (err) return done(err)
      expect(result).to.eql([])
      return done()
    })
  })

  it('Check that iamPermissions on a request field is included in APIdoc output', done => {
    const iamConfig = {
      http: config.http,
      apiDoc: {
        user: {
          fields: [
            {
              actions: ['find'],
              field: 'id',
              type: 'integer',
              description: 'User ID'
            },
            {
              actions: ['find'],
              field: 'extendedDetails',
              type: 'object',
              description: 'Extended user details',
              iamPermissions: ['user.extendedDetails'],
              properties: [
                {
                  field: 'address',
                  type: 'string',
                  description: 'User address',
                  iamPermissions: ['user.extendedDetails']
                }
              ]
            }
          ]
        }
      }
    }

    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find' }]
    }

    const { apiDoc } = acaee.apidocRoute(iamConfig, params)
    apiDoc({}, (err, result) => {
      if (err) return done(err)
      const doc = _.first(result)
      const field = _.find(doc.request.fields, { field: 'extendedDetails' })
      expect(field.iamPermissions).to.eql(['user.extendedDetails'])
      return done()
    })
  })

  it('Check that iamPermissions on a nested property is included in APIdoc output', done => {
    const iamConfig = {
      http: config.http,
      apiDoc: {
        user: {
          fields: [
            {
              actions: ['find'],
              field: 'extendedDetails',
              type: 'object',
              description: 'Extended user details',
              iamPermissions: ['user.extendedDetails'],
              properties: [
                {
                  field: 'address',
                  type: 'string',
                  description: 'User address',
                  iamPermissions: ['user.extendedDetails']
                }
              ]
            }
          ]
        }
      }
    }

    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find' }]
    }

    const { apiDoc } = acaee.apidocRoute(iamConfig, params)
    apiDoc({}, (err, result) => {
      if (err) return done(err)
      const doc = _.first(result)
      const field = _.find(doc.request.fields, { field: 'extendedDetails' })
      const nested = _.find(field.properties, { field: 'address' })
      expect(nested.iamPermissions).to.eql(['user.extendedDetails'])
      return done()
    })
  })

  it('Check that iamPermissions on a response field is included in APIdoc output', done => {
    const iamConfig = {
      http: config.http,
      apiDoc: {
        user: {
          fields: [
            {
              actions: ['find'],
              field: 'id',
              type: 'integer',
              description: 'User ID'
            },
            {
              actions: ['response.find'],
              field: 'id',
              type: 'integer',
              description: 'User ID'
            },
            {
              actions: ['response.find'],
              field: 'internalScore',
              type: 'integer',
              description: 'Internal score',
              iamPermissions: ['user.internalData']
            }
          ]
        }
      }
    }

    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find' }]
    }

    const { apiDoc } = acaee.apidocRoute(iamConfig, params)
    apiDoc({}, (err, result) => {
      if (err) return done(err)
      const doc = _.first(result)
      const field = _.find(doc.response.fields, { field: 'internalScore' })
      expect(field.iamPermissions).to.eql(['user.internalData'])
      return done()
    })
  })

  it('Check that iamPermissionsFor with action "find" does NOT apply to response fields', done => {
    const iamConfig = {
      http: config.http,
      apiDoc: {
        user: {
          fields: [
            {
              actions: ['find'],
              field: '-',
              description: 'No request parameters'
            },
            {
              actions: ['response.find'],
              field: 'settings',
              type: 'object',
              description: 'Settings',
              iamPermissionsFor: [
                { action: 'find', value: ['user.settings'] }
              ]
            }
          ]
        }
      }
    }

    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find' }]
    }

    const { apiDoc } = acaee.apidocRoute(iamConfig, params)
    apiDoc({}, (err, result) => {
      if (err) return done(err)
      const doc = _.first(result)
      const responseField = _.find(doc.response.fields, { field: 'settings' })
      expect(responseField.iamPermissions).to.be.undefined
      return done()
    })
  })

  it('Check that iamPermissionsFor is action-specific and only appears for matching action', done => {
    const iamConfig = {
      http: config.http,
      apiDoc: {
        user: {
          fields: [
            {
              // placeholder so prepareDocumentation finds at least one request field
              actions: ['find'],
              field: '-',
              description: 'No request parameters'
            },
            {
              actions: ['response.find'],
              field: 'settings',
              type: 'object',
              description: 'Settings',
              iamPermissionsFor: [
                { action: 'response.find', value: ['user.settings'] }
              ]
            }
          ]
        }
      }
    }

    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find' }]
    }

    const { apiDoc } = acaee.apidocRoute(iamConfig, params)
    apiDoc({}, (err, result) => {
      if (err) return done(err)
      const doc = _.first(result)
      const responseField = _.find(doc.response.fields, { field: 'settings' })
      expect(responseField.iamPermissions).to.eql(['user.settings'])
      return done()
    })
  })

  it('Check that iamPermissionsFor with action "response" applies to all response contexts', done => {
    const iamConfig = {
      http: config.http,
      apiDoc: {
        user: {
          fields: [
            {
              actions: ['find'],
              field: '-',
              description: 'No request parameters'
            },
            {
              actions: ['response'],
              field: 'settings',
              type: 'object',
              description: 'Settings',
              iamPermissionsFor: [
                { action: 'response', value: ['user.settings'] }
              ]
            }
          ]
        }
      }
    }

    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find' }]
    }

    const { apiDoc } = acaee.apidocRoute(iamConfig, params)
    apiDoc({}, (err, result) => {
      if (err) return done(err)
      const doc = _.first(result)
      const responseField = _.find(doc.response.fields, { field: 'settings' })
      expect(responseField.iamPermissions).to.eql(['user.settings'])
      return done()
    })
  })

  it('Check that fields without iamPermissions do not have the property in APIdoc output', done => {
    const iamConfig = {
      http: config.http,
      apiDoc: {
        user: {
          fields: [
            {
              actions: ['find'],
              field: 'id',
              type: 'integer',
              description: 'User ID'
            }
          ]
        }
      }
    }

    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [{ method: 'get', path: '/v1/user', action: 'find' }]
    }

    const { apiDoc } = acaee.apidocRoute(iamConfig, params)
    apiDoc({}, (err, result) => {
      if (err) return done(err)
      const doc = _.first(result)
      const field = _.find(doc.request.fields, { field: 'id' })
      expect(field.iamPermissions).to.be.undefined
      return done()
    })
  })

  it('Active route is preferred over deprecated route for the same action', done => {
    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [
        { method: 'get', path: '/v1/user/find/:id', action: 'find', deprecated: true },
        { method: 'get', path: '/v1/user/:id', action: 'find' }
      ]
    }

    const { apiDoc } = acaee.apidocRoute(config, params)

    apiDoc({}, (err, result) => {
      if (err) return done(err)
      expect(result).to.have.length(1)
      expect(result[0].path).to.eql('/v1/user/:id')
      expect(result[0].deprecated).to.be.undefined
      return done()
    })
  })

  it('Deprecated route is shown when no active route exists for the action', done => {
    const params = {
      name: 'user',
      availableActions: ['find'],
      routes: [
        { method: 'get', path: '/v1/user/find/:id', action: 'find', deprecated: true }
      ]
    }

    const { apiDoc } = acaee.apidocRoute(config, params)

    apiDoc({}, (err, result) => {
      if (err) return done(err)
      expect(result).to.have.length(1)
      expect(result[0].path).to.eql('/v1/user/find/:id')
      expect(result[0].deprecated).to.eql(true)
      return done()
    })
  })

  it('Check that only routes without apiDoc.enabled=false are included', done => {
    const configWithMultipleActions = {
      http: config.http,
      apiDoc: {
        user: {
          fields: [
            { actions: ['find'], field: 'lastname', type: 'string', description: 'Lastname' },
            { actions: ['create'], field: 'firstname', type: 'string', description: 'Firstname' }
          ]
        }
      }
    }

    const params = {
      name: 'user',
      availableActions: ['find', 'create'],
      routes: [
        { method: 'get', path: '/v1/user', action: 'find', name: 'Find user' },
        { method: 'post', path: '/v1/user', action: 'create', name: 'Create user', apiDoc: { enabled: false } }
      ]
    }

    const { apiDoc } = acaee.apidocRoute(configWithMultipleActions, params)

    apiDoc({}, (err, result) => {
      if (err) return done(err)
      expect(result).to.have.length(1)
      expect(result[0].name).to.eql('Find user')
      return done()
    })
  })
})

describe('defaultValues', () => {
  const fields = [
    { field: 'status', defaultsTo: 'active' },
    {
      field: 'settings',
      type: 'object',
      properties: [
        { field: 'limit', defaultsTo: 10 },
        { field: 'name' },
        { field: 'nested', properties: [{ field: 'flag', defaultsTo: true }] }
      ]
    },
    { field: 'plain' }
  ]

  it('returns the default of a simple field', () => {
    expect(acaee.defaultValues({ fields, field: 'status' })).to.eql({ status: 'active' })
  })

  it('returns defaults of nested properties recursively', () => {
    expect(acaee.defaultValues({ fields, field: 'settings' })).to.eql({ settings: { limit: 10, nested: { flag: true } } })
  })

  it('returns an empty object if there is no default', () => {
    expect(acaee.defaultValues({ fields, field: 'plain' })).to.eql({})
  })

  it('returns an empty object for an unknown field', () => {
    expect(acaee.defaultValues({ fields, field: 'unknown' })).to.eql({})
  })
})

describe('markedFields', () => {
  const fields = [
    { field: 'a', deprecated: true },
    { field: 'b', beta: true },
    {
      field: 'c',
      properties: [
        { field: 'd', deprecated: true },
        { field: 'e', properties: [{ field: 'f', deprecated: true }] }
      ]
    }
  ]

  it('returns deprecated fields including nested paths by default', () => {
    expect(acaee.markedFields({ fields })).to.eql(['a', 'c.d', 'c.e.f'])
  })

  it('uses a custom marker', () => {
    expect(acaee.markedFields({ fields, marker: 'beta' })).to.eql(['b'])
  })

  it('returns an empty array without fields', () => {
    expect(acaee.markedFields({})).to.eql([])
  })
})

describe('All Params - extended', () => {
  it('converts numeric strings in query/params but not in body', done => {
    const req = {
      query: { int: '5', float: '1.5', text: 'abc' },
      params: { id: '7' },
      body: { count: '3' }
    }
    acaee.allParams(req, {}, () => {
      const params = req.allParams()
      expect(params.int).to.eql(5)
      expect(params.float).to.eql(1.5)
      expect(params.text).to.eql('abc')
      expect(params.id).to.eql(7)
      expect(params.count).to.eql('3')
      return done()
    })
  })

  it('parses a text/plain body as JSON', done => {
    const req = {
      headers: { 'content-type': 'text/plain' },
      query: {},
      params: {},
      body: '{"lastname":"dooley"}'
    }
    acaee.allParams(req, {}, () => {
      expect(req.allParams()).to.eql({ lastname: 'dooley' })
      return done()
    })
  })

  it('does not fail on an invalid text/plain body', done => {
    const req = {
      headers: { 'content-type': 'text/plain' },
      query: {},
      params: {},
      body: 'not json'
    }
    const originalError = console.error
    console.error = () => {}
    acaee.allParams(req, {}, () => {
      console.error = originalError
      expect(req.allParams()).to.eql({})
      return done()
    })
  })

  it('does not log an error for a text/plain request without body', done => {
    const req = {
      headers: { 'content-type': 'text/plain' },
      query: { id: 1 },
      params: {}
    }
    let logged = false
    const originalError = console.error
    console.error = () => { logged = true }
    acaee.allParams(req, {}, () => {
      console.error = originalError
      expect(logged).to.eql(false)
      expect(req.allParams()).to.eql({ id: 1 })
      return done()
    })
  })

  it('does not log an error for a whitespace-only text/plain body', done => {
    const req = {
      headers: { 'content-type': 'text/plain' },
      query: { id: 1 },
      params: {},
      body: ' \n\t '
    }
    let logged = false
    const originalError = console.error
    console.error = () => { logged = true }
    acaee.allParams(req, {}, () => {
      console.error = originalError
      expect(logged).to.eql(false)
      expect(req.allParams()).to.eql({ id: 1 })
      return done()
    })
  })

  it('provides allParamsOriginal for signed requests', done => {
    const req = {
      headers: { 'x-admiralcloud-hash': 'abc' },
      body: { lastname: 'dooley' }
    }
    acaee.allParams(req, {}, () => {
      expect(req.allParamsOriginal()).to.eql({ lastname: 'dooley' })
      req.allParams().lastname = 'changed'
      expect(req.allParamsOriginal().lastname).to.eql('dooley')
      return done()
    })
  })
})

describe('mapFieldDefinition', () => {
  it('sets required=true if requiredFor has no condition', () => {
    const field = acaee.mapFieldDefinition({ field: 'a', requiredFor: [{ action: 'create' }] }, 'create', {})
    expect(field.required).to.eql(true)
  })

  it('sets required=false if the action is not in requiredFor', () => {
    const field = acaee.mapFieldDefinition({ field: 'a', requiredFor: [{ action: 'create' }] }, 'find', {})
    expect(field.required).to.eql(false)
  })

  it('takes over customErrorMessage', () => {
    const field = acaee.mapFieldDefinition({ field: 'a', requiredFor: [{ action: 'create', customErrorMessage: 'custom' }] }, 'create', {})
    expect(field.customErrorMessage).to.eql('custom')
  })

  it('evaluates a single condition with value', () => {
    const def = () => ({ field: 'a', requiredFor: [{ action: 'create', condition: { field: 'type', value: 'x' } }] })
    expect(acaee.mapFieldDefinition(def(), 'create', { type: 'x' }).required).to.eql(true)
    expect(acaee.mapFieldDefinition(def(), 'create', { type: 'y' }).required).to.eql(false)
  })

  it('evaluates a condition with op include', () => {
    const def = () => ({ field: 'a', requiredFor: [{ action: 'create', condition: [{ field: 'type', op: 'include', value: ['x', 'y'] }] }] })
    expect(acaee.mapFieldDefinition(def(), 'create', { type: 'y' }).required).to.eql(true)
    expect(acaee.mapFieldDefinition(def(), 'create', { type: 'z' }).required).to.eql(false)
  })

  it('evaluates a condition with only a field (truthy check on the field name)', () => {
    const field = acaee.mapFieldDefinition({ field: 'a', requiredFor: [{ action: 'create', condition: { field: 'other' } }] }, 'create', {})
    expect(field.required).to.eql('other')
  })

  it('resolves enumFor and iamPermissionsFor for the action', () => {
    const field = acaee.mapFieldDefinition({
      field: 'a',
      enumFor: [{ action: 'create', value: ['x'] }, { action: 'find', value: ['y'] }],
      iamPermissionsFor: [{ action: 'create', value: ['perm'] }]
    }, 'create', {})
    expect(field.enum).to.eql(['x'])
    expect(field.iamPermissions).to.eql(['perm'])
  })

  it('creates a range from rangeDef', () => {
    const now = Math.round(new Date().getTime() / 1000)
    const field = acaee.mapFieldDefinition({ field: 'a', rangeDef: { type: 'timestamp', deviation: 100 } }, 'find', {})
    expect(field.range[0]).to.be.closeTo(now - 100, 2)
    expect(field.range[1]).to.be.closeTo(now + 100, 2)
  })

  it('uses 0-100 as default range for rangeDef without type', () => {
    const field = acaee.mapFieldDefinition({ field: 'a', rangeDef: {} }, 'find', {})
    expect(field.range).to.eql([0, 100])
  })

  it('sets defaultsTo in params only if not yet set', () => {
    const params = {}
    acaee.mapFieldDefinition({ field: 'a', defaultsTo: 1 }, 'find', params)
    expect(params.a).to.eql(1)
    const params2 = { a: 5 }
    acaee.mapFieldDefinition({ field: 'a', defaultsTo: 1 }, 'find', params2)
    expect(params2.a).to.eql(5)
  })

  it('filters nested properties by action', () => {
    const field = acaee.mapFieldDefinition({
      field: 'obj',
      properties: [
        { field: 'p1' },
        { field: 'p2', actions: ['create'] },
        { field: 'p3', actions: ['find'] }
      ]
    }, 'find', {})
    expect(_.map(field.properties, 'field')).to.eql(['p1', 'p3'])
  })
})

describe('Sanitizer - extended', () => {
  const baseConfig = {
    http: config.http,
    apiDoc: {
      item: {
        fields: [
          { actions: ['find', 'response.find'], field: 'id', type: 'integer' },
          { actions: ['find', 'response.find'], field: 'name', type: 'string', optional: true },
          { actions: ['find', 'response.find'], field: 'extra', type: 'string', nullAllowedFor: [{ action: 'find' }], optional: true }
        ]
      }
    }
  }

  const buildReq = (body) => {
    const req = { query: {}, params: {}, body }
    acaee.allParams(req, {}, () => {})
    return req
  }

  it('calls next without apiDoc', done => {
    acaee.sanitizer({}, { controller: 'item', action: 'find' }, buildReq({}), {}, done)
  })

  it('calls next if the route has its own sanitizer', done => {
    acaee.sanitizer(baseConfig, { controller: 'item', action: 'find', sanitizer: true }, buildReq({}), {}, done)
  })

  it('calls next if the controller is not defined in apiDoc', done => {
    acaee.sanitizer(baseConfig, { controller: 'unknown', action: 'find' }, buildReq({}), {}, done)
  })

  it('calls next if no fields exist for the action', done => {
    acaee.sanitizer(baseConfig, { controller: 'item', action: 'destroy' }, buildReq({}), {}, done)
  })

  it('calls res.miscError on a sanitizing error', done => {
    const res = { miscError: error => {
      expect(error).to.exist
      return done()
    } }
    acaee.sanitizer(baseConfig, { controller: 'item', action: 'find' }, buildReq({ id: 'abc' }), res, () => done(new Error('should not call next')))
  })

  it('responds with the checked payload in test environment', done => {
    const testConfig = { ...baseConfig, environment: 'test' }
    const req = buildReq({ id: 1, checkPayload: true, name: 'abc', extra: null })
    let released = false
    const res = {
      emit: event => { if (event === 'releaseLock') released = true },
      json: payload => {
        expect(released).to.eql(true)
        expect(payload.id).to.eql(1)
        expect(payload.name).to.eql('abc')
        expect(payload).to.not.have.property('extra')
        return done()
      }
    }
    acaee.sanitizer(testConfig, { controller: 'item', action: 'find' }, req, res, () => done(new Error('should not call next')))
  })
})

describe('fieldDefinition', () => {
  it('returns noAPIdoc for an unknown controller', () => {
    const result = acaee.fieldDefinition(config, 'lastname', 'unknown', 'find')
    expect(result.message).to.eql('noAPIdoc')
    expect(result.additionalInfo).to.eql({ controller: 'unknown', action: 'find' })
  })

  it('returns the mapped field definition', () => {
    const result = acaee.fieldDefinition(config, 'lastname', 'user', 'find')
    expect(result.field).to.eql('lastname')
    expect(result.type).to.eql('string')
  })
})

describe('filterResponseByPermissions - extended', () => {
  const permConfig = {
    apiDoc: {
      user: {
        fields: [
          { actions: ['response'], field: 'name', type: 'string' },
          { actions: ['response'], field: 'secret', type: 'string', iamPermissions: ['user:secret'] }
        ]
      }
    }
  }

  it('falls back to "response" if no action specific fields exist', () => {
    const result = acaee.filterResponseByPermissions({ config: permConfig, controller: 'user', action: 'find', body: { name: 'a', secret: 'b' }, userPermissions: [] })
    expect(result).to.eql({ name: 'a' })
  })

  it('returns the body if no response fields are defined', () => {
    const body = { a: 1 }
    const noResponse = { apiDoc: { user: { fields: [{ actions: ['find'], field: 'a' }] } } }
    expect(acaee.filterResponseByPermissions({ config: noResponse, controller: 'user', action: 'find', body })).to.eql(body)
  })

  it('returns non-object bodies unchanged', () => {
    expect(acaee.filterResponseByPermissions({ config: permConfig, controller: 'user', action: 'find', body: 'text' })).to.eql('text')
  })
})

describe('prepareDocumentation', () => {
  const docConfig = {
    user: {
      headers: [{ name: 'x-test' }],
      descriptions: [{ action: 'find', description: 'Find users' }],
      response: { find: { type: 'array' } },
      fields: [
        { actions: ['find'], field: 'id', type: 'integer', requiredFor: [{ action: 'find', condition: 'cond' }], nullAllowedFor: [{ action: 'find' }] },
        { actions: ['find'], field: 'hidden', type: 'string', noDocumentation: true },
        { actions: ['find'], field: 'legacy', type: 'object', schema: {
          flatKey: { flat: true, description: 'flat', allowedKeys: [{ type: 'string' }] },
          objKey: { required: true, description: 'obj', allowedKeys: [{ key: 'k', type: 'string', description: 'kd', isMemberOf: ['a'] }] }
        } },
        { actions: ['find'], field: 'multi', type: 'string', description: [{ action: 'find', message: 'multi desc' }],
          enumFor: [{ action: 'find', value: ['a', 'b'] }] },
        { actions: ['response.find'], field: 'id', type: 'integer', enumFor: [{ action: 'response.find', value: [1] }] },
        { actions: ['response.special'], field: 'special', type: 'string' },
        { actions: ['response'], field: 'general', type: 'string' }
      ],
      examples: [
        { identifier: 'base', response: { a: 1, b: 2 } },
        { action: 'find', response: { identifier: 'base', b: 3 } },
        { action: 'create', response: { x: 1 } }
      ]
    }
  }
  const route = { method: 'get', path: '/v1/user', name: 'Find' }

  it('returns an empty object for an unknown controller', () => {
    expect(acaee.prepareDocumentation({ controller: 'unknown', action: 'find', route, apiDoc: docConfig })).to.eql({})
  })

  it('returns false if no request fields exist for the action', () => {
    expect(acaee.prepareDocumentation({ controller: 'user', action: 'nothing', route, apiDoc: docConfig })).to.eql(false)
  })

  it('builds the documentation', () => {
    const doc = acaee.prepareDocumentation({ controller: 'user', action: 'find', route, apiDoc: docConfig })
    expect(doc.name).to.eql('Find')
    expect(doc.description).to.eql('Find users')
    expect(doc.headers).to.eql([{ name: 'x-test' }])
    expect(doc.response.type).to.eql('array')
    expect(_.map(doc.request.fields, 'field')).to.eql(['id', 'legacy', 'multi'])
    expect(_.find(doc.request.fields, { field: 'id' }).required).to.eql('cond')
    expect(_.find(doc.request.fields, { field: 'id' }).nullAllowed).to.eql(true)
    expect(_.find(doc.request.fields, { field: 'multi' }).description).to.eql('multi desc')
    expect(_.find(doc.request.fields, { field: 'multi' }).enum).to.eql(['a', 'b'])
    expect(_.map(doc.response.fields, 'field')).to.eql(['id'])
    expect(_.find(doc.response.fields, { field: 'id' }).enum).to.eql([1])
  })

  it('converts the deprecated schema definition to properties', () => {
    const doc = acaee.prepareDocumentation({ controller: 'user', action: 'find', route, apiDoc: docConfig })
    const legacy = _.find(doc.request.fields, { field: 'legacy' })
    expect(legacy.properties).to.have.length(2)
    expect(legacy.properties[0]).to.include({ field: 'flatKey', type: 'string', required: false })
    expect(legacy.properties[1]).to.include({ field: 'objKey', type: 'object' })
    expect(legacy.properties[1].properties[0]).to.include({ field: 'k', type: 'string' })
  })

  it('merges examples with identifier', () => {
    const doc = acaee.prepareDocumentation({ controller: 'user', action: 'find', route, apiDoc: docConfig })
    expect(doc.examples).to.have.length(1)
    expect(doc.examples[0].response).to.eql({ identifier: 'base', a: 1, b: 3 })
  })

  it('uses responseName for response fields', () => {
    const doc = acaee.prepareDocumentation({ controller: 'user', action: 'find', route, apiDoc: docConfig, responseName: 'special' })
    expect(_.map(doc.response.fields, 'field')).to.eql(['special'])
  })

  it('falls back to "response" if no response.action fields exist', () => {
    const doc = acaee.prepareDocumentation({ controller: 'user', action: 'find', route, apiDoc: {
      user: { fields: [{ actions: ['find'], field: 'id', type: 'integer' }, { actions: ['response'], field: 'general', type: 'string' }] }
    } })
    expect(_.map(doc.response.fields, 'field')).to.eql(['general'])
  })
})

describe('apidocRoute - extended', () => {
  const routeConfig = {
    http: config.http,
    apiDoc: {
      user: {
        fields: [
          { actions: ['find'], field: 'id', type: 'integer' },
          { actions: ['create'], field: 'name', type: 'string' }
        ]
      }
    }
  }
  const params = {
    name: 'User',
    availableActions: ['find', 'create'],
    routes: [
      { method: 'get', path: '/v1/user', action: 'find' },
      { method: 'post', path: '/v1/user', action: 'create' }
    ]
  }

  it('returns the apiDoc route definition', () => {
    const { apiDocRoute } = acaee.apidocRoute(routeConfig, params)
    expect(apiDocRoute.path).to.eql('/v1/user/apidoc')
    expect(apiDocRoute.method).to.eql('get')
    expect(apiDocRoute.policies).to.eql(true)
  })

  it('responds with res.json and sets no-cache header', () => {
    const { apiDoc } = acaee.apidocRoute({ ...routeConfig, controller: 'user' }, { ...params, name: 'user' })
    let header
    let body
    apiDoc({ query: {} }, {
      setHeader: (key, value) => { header = [key, value] },
      json: data => { body = data }
    })
    expect(header[0]).to.eql('Cache-Control')
    expect(body).to.have.length(2)
  })

  it('filters by name', done => {
    const { apiDoc } = acaee.apidocRoute(routeConfig, { ...params, name: 'user' })
    apiDoc({ query: { name: 'find' } }, (err, result) => {
      expect(result).to.have.length(1)
      expect(result[0].name).to.eql('find')
      return done()
    })
  })

  it('filters by name "crud"', done => {
    const { apiDoc } = acaee.apidocRoute(routeConfig, { ...params, name: 'user', availableActions: ['find', 'create', 'other'], routes: [...params.routes, { method: 'get', path: '/v1/user/other', action: 'other' }] })
    apiDoc({ query: { name: 'crud' } }, (err, result) => {
      expect(result).to.have.length(2)
      return done()
    })
  })
})
