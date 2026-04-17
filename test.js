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