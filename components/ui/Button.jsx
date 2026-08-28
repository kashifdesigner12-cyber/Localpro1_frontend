'use client';

import { Loader2 } from 'lucide-react';

export const Button = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon = null,
  children,
  className = '',
  type = 'button',
  ...rest
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer select-none';

  const variants = {
    primary: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] shadow-sm hover:shadow focus:ring-[#2563EB] focus:ring-offset-white',
    secondary: 'bg-white text-[#26344D] border border-[#E2E8F0] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] active:bg-[#F1F5F9] focus:ring-[#94A3B8]',
    ghost: 'text-[#64748B] hover:bg-[#EEF4FF] hover:text-[#2563EB] active:bg-[#DBEAFE] focus:ring-[#2563EB]',
    destructive: 'bg-[#EF4444] text-white hover:bg-[#DC2626] active:bg-[#B91C1C] shadow-sm focus:ring-[#EF4444]',
    outline: 'border-2 border-[#2563EB] text-[#2563EB] hover:bg-[#EEF4FF] active:bg-[#DBEAFE] focus:ring-[#2563EB]',
  };

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs h-8.5 gap-1.5',
    md: 'px-4 py-2.5 text-[13.5px] h-10 gap-2',
    lg: 'px-5 py-2.5 text-sm h-11 gap-2',
    xl: 'px-6 py-3.5 text-base h-12 gap-2.5 font-semibold',
  };

  const classes = `${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {!loading && icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;