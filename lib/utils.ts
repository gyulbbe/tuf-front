type ClassNameValue =
  | ClassNameValue[]
  | false
  | null
  | string
  | undefined;

function appendClassNames(value: ClassNameValue, classNames: string[]) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => appendClassNames(entry, classNames));
    return;
  }

  classNames.push(value);
}

export function cn(...inputs: ClassNameValue[]) {
  const classNames: string[] = [];

  inputs.forEach((input) => appendClassNames(input, classNames));

  return classNames.join(" ");
}
