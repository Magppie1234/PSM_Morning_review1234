// The reporting period a request asks for (?timeframe=, or the older ?period=); Daily when absent.
export const timeframeOf = (request) => request.query.timeframe || request.query.period || 'daily';
