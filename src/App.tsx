import { useEffect } from 'react'
import { supabase } from './lib/supabase'

function App() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      console.log('supabase ok', { data, error })
    })
  }, [])
  return <h1 className="text-3xl font-bold p-8">Finance</h1>
}
export default App