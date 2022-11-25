/* WT FEEDBACK
  Coding style question: You use CamelCase for modules (and presumably classes), but then snake_case for functions/methods/variables.. what's the personal philosophy/reason behind that mixing of styles?
*/

/* WT FEEDBACK
  LIKE:
  - Clever optional way to do required params, when needed/wanted. Interesting idea to keep it in signature.
  - Technically extensible
  DISLIKE:
  - Error Prone:
    - Dev user needs to construct own call_path properly or debugging will be a nightmare - case and point in verify_data_conforms_to_spec function below.
    - If I pass in just function and param name (validate.data), my Error for debugging will be incorrect (function will be module, and param name will be function..)
  - Obscure:
    - call_path assumes 3 parts.. then why not just do 3 params with some defaults? like required( module, function, param ), so the dev can see their args when calling?
    - assumes string based structure to be known/understood by caller, only to be split() up immediately into assumed parts.
  - Rigid: Why do we need each using function to be in module?
  - (Total Unimportant Nitpick) If standardizing arg error, why not use TypeError?
  PERSONAL VERDICT:
  - Dev-only or not, I would never want to use this mechanism; requires me to understand/know too much while giving me too much opportunity to shoot myself in the foot.
*/
// We can avoid needing this by using TypeScript, but since we're using raw Javascript for this example we'll just implement some basic parameter checking for user facing code. We wouldn't use a method like this in an actual production level code base.
const required = (call_path = '') => {
  const [ module_name, function_name, parameter_name ] = call_path.split('.')
  throw new Error(`The module '${module_name}' function '${function_name}' requires the parameter '${parameter_name}', but none was provided.`)
}

/* WT FEEDBACK
  Respecting your comment just below about splitting out modules in a real use case;
  regardless, why not use a static class instead in this case?
*/
// Normally we'd have these types of modules split amongst multiple files and importing them via some sorta bundler, but since this is an example we'll just do it all in this one file here, but in a production environment WnApi, WnSpec, WnData, WnUtils, WnSelect, and any non generic / bootstrap related code would live in their own respective files in the project structure, organized in a manner that makes sense.
const WnApi = {
  api_url_base: 'https://widenode.io',

  gen_api_url({
    endpoint = required('WnApi.gen_api_url.endpoint'),
  } = {}) {
    return `${this.api_url_base}/${endpoint}`
  },

  /* WT FEEDBACK
    LIKE:
    - Thorough in defining options default for destructuring for when user does just fetch()
    DISLIKE:
    - constructing 'WnApi.fetch.endpoint' manually, and correctly (see "required" feedback above for more..)
  */
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
    /* WT Feedback
      Case for my dislike of the required mechanism -- spec param has invalid parameter value in constructed string. The mistake is not the problem; I would do this
      accidentally all the time, and the fallout is that I'm debugging wrong fields without good way to trace back.. Shoot-myself-in-foot case.
    */
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

        /* WT FEEDBACK
          This is a strange approach. It took me a couple squinty looks to "click" on what you're doing here with the type-as-function call.
          If you're checking for a function and then calling it see a default init value of the type constructor... and THEN doing a separate check on the data..
            ... then why not just make the validator a function that processes the data with a boolean is-valid response? Like always just "if( spec_validator( data_value ) )"
            ... and then, why not just make EVERY validator a simple function consistently for every validator so you don't need all this case-by-case validation code below?
        */

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

    /* WT FEEDBACK
      LIKE:
      - This logic is very clear and minimal for this use case.
      DISLIKE:
      - MINOR: The logic here would require rework if we were looking for non-object values.
        ... I think separating a more general validator for the whole "right" value would be more extensible.
    */
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
      /* WT FEEDBACK
        (Minor Nitpick Only) Why not wrap the Set.add and results.push in the !Set.has condition, and then return results only once at the end?
      */
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

/* WT FEEDBACK
  IMO, this validator (though TypeScript-like) is annoying to process...
  why not something with a singular (and more extensible) "function" field validation mechanism, like this:

const user_data_spec = () => {
  return {
    $type: v => v === 'user',
    id: Number.isFinite,  // OR the more dangerous typeof v === number
    name: v => typeof v === 'string',
  }
}
*/

const user_data_spec = () => {
  return {
    $type: 'user',
    id: Number,
    name: String,
  }
}

console.log( Number.isFinite( "101" ) )

/* WT FEEDBACK
  (minor nitpick only) Why a return in this arrow function? Why not arrow directly to result?
*/
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
/* WT FEEDBACK
  LOL! Now I know a good down-side to sans-";" JavaScript.. Cuz this would never work without the leading ; (just laughing I never knew this)
*/
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
