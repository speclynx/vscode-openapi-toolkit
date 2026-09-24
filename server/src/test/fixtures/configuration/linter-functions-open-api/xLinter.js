(element) => {
  if (element && _apidom.isObjectElement(element) && element.element === 'contact') {
    if (!element.get('x-speclynx-team')) {
      return false;
    }
  }
  return true;
}
