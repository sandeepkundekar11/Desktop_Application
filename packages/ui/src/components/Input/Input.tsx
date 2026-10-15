import React, { FC, InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly id: string;
  readonly label?: string;
  readonly error?: string;
  readonly helperText?: string;
}

export const Input: FC<InputProps> = ({
  id,
  label,
  error,
  helperText,
  disabled = false,
  className = '',
  ...rest
}) => {
  const hasError = Boolean(error);
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const ariaDescribedBy = hasError
    ? errorId
    : helperText
    ? helperId
    : undefined;

  const inputClass = `ui-input ${hasError ? 'ui-input--error' : ''} ${className}`.trim();

  return (
    <div className="ui-input-group">
      {label && (
        <label htmlFor={id} className="ui-label">
          {label}
        </label>
      )}
      <input
        id={id}
        className={inputClass}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={ariaDescribedBy}
        {...rest}
      />
      {hasError && (
        <span id={errorId} className="ui-error-message" role="alert">
          {error}
        </span>
      )}
      {!hasError && helperText && (
        <span id={helperId} className="ui-helper-text">
          {helperText}
        </span>
      )}
    </div>
  );
};
