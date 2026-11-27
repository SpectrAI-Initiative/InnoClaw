"""Generate private local-only credentials and a reproducible realm import."""
from pathlib import Path
import json,secrets,os
root=Path(__file__).resolve().parent
runtime=root/'runtime';runtime.mkdir(exist_ok=True);os.chmod(runtime,0o700)
f=runtime/'local.env'
if not f.exists():
 values={k:secrets.token_hex(24) for k in ['KC_DB_PASSWORD','KC_ADMIN_PASSWORD','OIDC_SECRET','AUTH_SECRET']}
 f.write_text('\n'.join(k+'='+v for k,v in values.items())+'\n');f.chmod(0o600)
values=dict(line.split('=',1) for line in f.read_text().splitlines())
realm={'realm':'innoscale','loginTheme':'innoscale','displayName':'Innoscale','enabled':True,'registrationAllowed':True,'registrationEmailAsUsername':True,'loginWithEmailAllowed':True,'verifyEmail':True,'resetPasswordAllowed':True,'sslRequired':'none','bruteForceProtected':True,'passwordPolicy':'length(12)','smtpServer':{'host':'mailpit','port':'1025','from':'accounts@innoscale.test','fromDisplayName':'Innoscale','ssl':'false','starttls':'false','auth':'false'},'clients':[{'clientId':'innoscale-local','enabled':True,'publicClient':False,'secret':values['OIDC_SECRET'],'standardFlowEnabled':True,'directAccessGrantsEnabled':False,'redirectUris':['http://localhost:3200/api/auth/oidc/callback'],'webOrigins':['http://localhost:3200'],'defaultClientScopes':['web-origins','acr','profile','email'],'attributes':{'pkce.code.challenge.method':'S256','post.logout.redirect.uris':'http://localhost:3200/login'}}]}
f=runtime/'realm.json';f.write_text(json.dumps(realm,indent=2));f.chmod(0o600)
print('Local configuration ready. Existing database realms are not overwritten on restart.')
