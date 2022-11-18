// We can avoid needing this by using TypeScript, but since we're using raw Javascript for this example we'll just implement some basic parameter checking for user facing code. We wouldn't use a method like this in an actual production level code base.
const required = (call_path = '') => {
  const [ module_name, function_name, parameter_name ] = call_path.split('.')
  throw new Error(`The module '${module_name}' function '${function_name}' requires the parameter '${parameter_name}', but none was provided.`)
}

// Normally we'd have these types of modules split amongst multiple files and importing them via some sorta bundler, but since this is an example we'll just do it all in this one file here, but in a production environment WnApi, WnSpec, WnData, WnUtils, WnSelect, and any non generic / bootstrap related code would live in their own respective files in the project structure, organized in a manner that makes sense.
const WnApi = {
  api_url_base: 'https://widenode.io',

  gen_api_url({
    endpoint = required('WnApi.gen_api_url.endpoint'),
  } = {}) {
    return `${this.api_url_base}/${endpoint}`
  },

  async fetch({
    endpoint = required('WnApi.fetch.endpoint'),
  } = {}) {
    try {
      const api_url = this.gen_api_url({ endpoint })
      const result = await fetch(api_url)
      const json = await result.json()
      return json
    } catch (error) {
      console.error(`error retrieving data from ${api_url}:`, error)
      throw error
    }
  },
}

const WnSpec = {
  verify_data_conforms_to_spec ({
    data = required('WnSpec.verify_data_conforms_to_spec.data'),
    spec = required('WnSpec.verify_data_conforms_to_spec.data'),
  } = {}) {
    // Note: We could augment this function to handle arrays and objects as well, if the spec use case were to present itself to require it

    const data_fields = Object.entries(data)
    const spec_fields = Object.entries(spec)

    // Before we even bother validating anything, make sure that the number of fields in the data object we've received match the amount of fields specified in the spec. If it doesn't, we want to give up immediately and short circuit.
    if (data_fields.length !== spec_fields.length) {
      console.warn('data and spec fields do not match.', data, spec, data_fields)
      return false
    }

    const spec_field_matches = []

    for (const [ data_key, data_value ] of data_fields) {

      const spec_value = spec[data_key]

      if (spec_value) {

        // Validate generic number match
        if ((typeof spec_value === 'function' && spec_value() === 0) && typeof data_value === 'number') {
          spec_field_matches.push([ data_key, data_value ])
        }

        // Validate generic string match
        if ((typeof spec_value === 'function' && spec_value() === '') && typeof data_value === 'string') {
          spec_field_matches.push([ data_key, data_value ])
        }

        // Validate generic value match
        if ((typeof spec_value === 'string' || typeof spec_value === 'number') && data_value === spec_value) {
          spec_field_matches.push([ data_key, data_value ])
        }
      }
    }

    if (spec_field_matches.length === spec_fields.length) return true
    console.warn('data matches spec in shape, but not in values.', data, spec, data_fields, spec_field_matches)
    return false
  },
}

const WnData = {
  find_data_conforming_to_spec({
    data = required('WnData.find_data_conforming_to_spec.data'),
    spec = required('WnData.find_data_conforming_to_spec.spec'),
    results = [],
  } = {}) {

    const parsed = Object.entries(data).reduce((results, [ key, value ]) => {
      if (Array.isArray(value)) return this.find_data_conforming_to_spec({ data: value, spec, results })

      if (typeof value === 'object' && value !== null) {

        if (WnSpec.verify_data_conforms_to_spec({ data: value, spec })) {
          results.push(value)
          return results
        }

        return this.find_data_conforming_to_spec({ data: value, spec, results })
      }

      return results
    }, results)

    return parsed
  },
}

const WnUtils = {
  find_distinct_data_by_key({
    data = required('WnUtils.find_distinct_data_by_key.data'),
    key = required('WnUtils.find_distinct_data_by_key.key')
  } = {}) {
    const distinct_keys = new Set()

    const distinct_values = data.reduce((results, value) => {
      if (distinct_keys.has(value[key])) return results

      distinct_keys.add(value[key])
      results.push(value)
      return results
    }, [])

    return distinct_values
  },
  sort_data_alphabetically_by_key({
    data = required('WnUtils.sort_data_alphabetically_by_key.data'),
    key = required('WnUtils.sort_data_alphabetically_by_key.key')
  }) {
    const sorted_data = [...data].sort((a_data, b_data) => {
      return a_data[key].localeCompare(b_data[key])
    })

    return sorted_data
  },
}

const WnSelect = {
  component () {
    return class extends HTMLElement {
      constructor() {
        super()

        this._options = []

        const template = document.getElementById('wn-select')
        this._shadow = this.attachShadow({ mode: 'open' })
        this._shadow.appendChild(template.content.cloneNode(true))

        this._select_el = this._shadow.getElementById('wn-select-el')
      }

      set options(options = []) {
        this._options = options

        this._select_el.innerHTML = ''

        for (const option of options) {
          const option_el = document.createElement('option')

          option_el.value = option.key
          option_el.innerHTML = option.value

          this._select_el.appendChild(option_el)
        }
      }

      get options() {
        return this._options
      }
    }
  },
  register_component () {
    customElements.define('wn-select', this.component())
  },
  transform_data_to_options({
    data = required('WnSelect.transform_data_to_options.data'),
    transform_spec = required('WnSelect.transform_data_to_options.transform_spec'),
  } = {}) {
    return data.map(transform_spec)
  },
  render_options_to_component({
    options = required('WnSelect.render_options_to_component.options'),
    selector = required('WnSelect.render_options_to_component.selector'),
  } = {}) {
    const el = document.querySelector(selector)
    el.options = options
  },
}

const user_data_spec = () => {
  return {
    $type: 'user',
    id: Number,
    name: String,
  }
}

const user_transform_option_spec = (data_value) => {
  return {
    key: data_value.id,
    value: `${data_value.name} (${data_value.id})`,
  }
}

const some_other_options = [{
  key: 'ahoy',
  value: 'This is the only option!',
}]

const arbitrary_options = [{
  key: 'hello',
  value: 'Hello World',
}, {
  key: 'goodbye',
  value: 'Goodbye Universe',
}]

// Bootstrap any web components we have
WnSelect.register_component()

// Since we don't need to wait for anything to render on the DOM or for any other resources to be loaded, we can just trigger this via an IIFE instead of waiting for the window load event like we normally would want to for client side related code, and things will be fine.
;(async () => {
  try {
    // Load client side options immediately
    WnSelect.render_options_to_component({ options: some_other_options, selector: '#some-other-select' })
    WnSelect.render_options_to_component({ options: arbitrary_options, selector: '#arbitrary-options-select' })

    // Fetch remote api options and update options as soon as we're able to
    const api_data = await WnApi.fetch({ endpoint: 'testing/exercises/exercise1.json' })
    const instances = WnData.find_data_conforming_to_spec({ data: api_data, spec: user_data_spec() })
    const distinct_instances = WnUtils.find_distinct_data_by_key({ data: instances, key: 'id' })
    const sorted_distinct_instances = WnUtils.sort_data_alphabetically_by_key({ data: distinct_instances, key: 'name' })
    const select_el_options = WnSelect.transform_data_to_options({
      data: sorted_distinct_instances,
      transform_spec: user_transform_option_spec,
    })

    WnSelect.render_options_to_component({ options: select_el_options, selector: '#users-select' })
  } catch (error) {
    console.error('error generating data options.', error)
    throw error
  }
})()
