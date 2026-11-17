import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

const PasswordInput = ({
  id = 'password',
  name = 'password',
  value,
  onChange,
  placeholder = '••••••••',
  required = true,
  disabled = false,
  autoComplete = 'current-password'
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
        <Lock className="h-4 w-4" />
      </div>
      <input
        id={id}
        name={name}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="block w-full pl-10 pr-11 py-3 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-blue-600/10 transition-all disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        disabled={disabled}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden transition-colors"
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 transition-transform active:scale-90" />
        ) : (
          <Eye className="h-4 w-4 transition-transform active:scale-90" />
        )}
      </button>
    </div>
  );
};

export default PasswordInput;
