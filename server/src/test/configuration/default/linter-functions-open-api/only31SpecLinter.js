(element) => {
  if (element && (0, _apidom.isStringElement)(element)) {
    const re = /"/gi;

    if (!String(element.toValue()).replace(re, '').match(/^3\.1\.[0-9]*$/)) {
      return false;
    }
  }

  return true;
}

