import { useState } from 'react'
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/react'

type Option = { value: string; label: string }

interface Props {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  required?: boolean
  disabled?: boolean
}

export default function SearchableSelect({ options, value, onChange, placeholder, id, required, disabled }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query === ''
    ? options
    : options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <Combobox
      value={value}
      onChange={(v: string) => { onChange(v); setQuery('') }}
      immediate
      onClose={() => setQuery('')}
    >
      <div className="relative">
        <ComboboxInput
          id={id}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className="border rounded px-3 py-2 w-full pr-10"
          displayValue={(v: string) => options.find(o => o.value === v)?.label ?? ''}
          onChange={e => setQuery(e.target.value)}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </ComboboxButton>
        <ComboboxOptions
          className="absolute left-0 right-0 top-full mt-1 max-h-60 overflow-auto rounded border bg-white shadow-lg text-sm z-50"
        >
          {filtered.length === 0 && query !== '' ? (
            <div className="px-3 py-2 text-slate-400">No matches</div>
          ) : (
            filtered.map(o => (
              <ComboboxOption
                key={o.value}
                value={o.value}
                className="data-[focus]:bg-slate-100 px-3 py-2 cursor-pointer"
              >
                {o.label}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  )
}
