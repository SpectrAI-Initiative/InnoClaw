"""Exercise registration and password recovery through real local SMTP messages."""
from pathlib import Path
import urllib.request as u,urllib.parse as p,http.cookiejar,json,re,time,html,secrets
from html.parser import HTMLParser
APP='http://localhost:3200';KC='http://localhost:8280';MAIL='http://localhost:8025'
class Form(HTMLParser):
 def __init__(self):super().__init__();self.action=None;self.fields={}
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='form' and self.action is None:self.action=a.get('action')
  if t=='input' and a.get('type')=='hidden' and a.get('name'):self.fields[a['name']]=a.get('value','')
def client():
 jar=http.cookiejar.CookieJar();return u.build_opener(u.ProxyHandler({}),u.HTTPCookieProcessor(jar)),jar
o,jar=client()
def request(url,data=None):
 # Match browser localhost Secure-cookie behavior for this HTTP-only test.
 for c in jar:c.secure=False
 return o.open(p.urljoin(KC,url),p.urlencode(data).encode() if data is not None else None,timeout=20)
def form(page,values):
 f=Form();f.feed(page);assert f.action,'Expected a form';f.fields.update(values);return request(f.action,f.fields)
def link(page,part):
 return html.unescape(next(x for x in re.findall(r'href="([^"]+)"',page) if part in x))
def message(email,subject):
 api=u.build_opener(u.ProxyHandler({}))
 for _ in range(30):
  messages=json.load(api.open(MAIL+'/api/v1/messages'))['messages']
  for m in messages:
   if any(t.get('Address')==email for t in m['To']) and subject.lower() in m['Subject'].lower():
    detail=json.load(api.open(MAIL+'/api/v1/message/'+m['ID']))
    return html.unescape(re.search(r'http://localhost:8280/[^\s<>"\)]+',detail['Text']).group(0))
  time.sleep(1)
 raise AssertionError('Email not received')
# Synthetic accounts must never send email through the live SMTP provider.
env = dict(line.split("=", 1) for line in (Path(__file__).parent / "runtime/local.env").read_text().splitlines())
admin, _ = client()
token = json.load(admin.open(KC + "/realms/master/protocol/openid-connect/token", p.urlencode({"client_id": "admin-cli", "grant_type": "password", "username": "admin", "password": env["KC_ADMIN_PASSWORD"]}).encode()))["access_token"]
realm = json.load(admin.open(u.Request(KC + "/admin/realms/innoscale", headers={"Authorization": "Bearer " + token})))
assert realm.get("smtpServer", {}).get("host") == "mailpit", "Refusing synthetic email test: switch to local Mailpit first"
email='researcher-'+secrets.token_hex(4)+'@example.test';password=secrets.token_urlsafe(18)
page=request(APP+'/api/auth/oidc/start').read().decode()
page=request(link(page,'registration')).read().decode()
page=form(page,{'email':email,'firstName':'Local','lastName':'Researcher','password':password,'password-confirm':password}).read().decode()
assert 'verify' in page.lower()
try:request(APP+'/api/auth/me');raise AssertionError('Unverified account admitted')
except u.HTTPError as e:assert e.code==401
r=request(message(email,'verify'));page=r.read().decode()
if 'id="password-new"' in page:
 page=form(page,{'password-new':password,'password-confirm':password}).read().decode()
# Some Keycloak versions require confirmation when an action link opens separately.
if 'kc-verify-email-form' in page:page=form(page,{}).read().decode()
me=json.load(request(APP+'/api/auth/me'));assert me['user']['email']==email and me['user']['role']=='user'
print('PASS registration -> SMTP email -> verification link -> application session')
def logout():
 r=request(APP+'/api/auth/logout',{});data=json.load(r);assert data['logoutUrl'].startswith(KC)
 page=request(APP+'/login').read().decode()
 if 'kc-logout-confirm' in page or 'name="confirmLogout"' in page:form(page,{'confirmLogout':'Confirm logout'})
 try:request(APP+'/api/auth/me');raise AssertionError('Session survived logout')
 except u.HTTPError as e:assert e.code==401
logout()
page=request(APP+'/api/auth/oidc/start').read().decode();assert 'kc-form-login' in page,'SSO survived logout'
page=request(link(page,'reset-credentials')).read().decode();form(page,{'username':email})
page=request(message(email,'reset')).read().decode();new_password=secrets.token_urlsafe(18)
r=form(page,{'password-new':new_password,'password-confirm':new_password});r.read()
# Reset may establish a provider session; use a fresh browser to test passwords.
o,jar=client();page=request(APP+'/api/auth/oidc/start').read().decode();page=form(page,{'username':email,'password':password}).read().decode();assert 'kc-form-login' in page,'Old password accepted'
page=form(page,{'username':email,'password':new_password}).read().decode();assert json.load(request(APP+'/api/auth/me'))['user']['email']==email
print('PASS reset email -> new password -> old password rejected -> new password login')
logout();print('PASS local session and Keycloak SSO logout')
for endpoint in ['login','register']:
 try:request(APP+'/api/auth/'+endpoint,{});raise AssertionError('Local credentials route enabled')
 except u.HTTPError as e:assert e.code==403
print('PASS local password/register endpoints disabled in managed mode')
