/** Turns a User-Agent into a readable device name like "Chrome on macOS". */
const parseDevice = (req) => {
  const ua = req.headers['user-agent'] || '';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua) || /CriOS/.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let os = 'Unknown OS';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let deviceType = 'desktop';
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) deviceType = 'tablet';
  else if (/Mobi|iPhone|Android/.test(ua)) deviceType = 'mobile';

  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].replace('::ffff:', '').replace('::1', 'localhost');
  return { browser, os, deviceType, ip, deviceName: `${browser} on ${os}` };
};

module.exports = { parseDevice };
