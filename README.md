# Task List Kiosk

Aplicacion web para proyectar anuncios y tareas en TV, controlada desde movil/PC, con sincronizacion en tiempo real y persistencia usando Firebase.

## Como funciona ahora

1. La TV abre `display.html` y usa un ID fijo (`tv`) en la URL.
2. Los controles abren `controller.html` y se conectan al mismo ID.
3. Todo se guarda en Firestore: tareas, anuncios, modo activo e historial.
4. Si la TV se apaga y vuelve, recupera el estado automaticamente.

## Setup rapido de Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Agrega una Web App en el proyecto.
3. Copia la configuracion Web App (apiKey, authDomain, projectId, etc).
4. Edita `js/firebase-config.js` y reemplaza todos los `REPLACE_ME`.
5. En Firebase habilita Authentication > Sign-in method > Anonymous.
6. En Firestore Database crea la base en modo production.
7. En Firestore Rules pega reglas base seguras para este proyecto.

Reglas sugeridas iniciales:

```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /kiosks/{tvId} {
			allow read: if true;
			allow write: if request.auth != null;

			match /history/{eventId} {
				allow read: if request.auth != null;
				allow write: if request.auth != null;
			}
		}
	}
}
```

## URLs de uso

1. TV:
	 `https://charly-sanchez.github.io/Task_List_Kiosk/display.html?tv=TV-1234`
2. Control:
	 `https://charly-sanchez.github.io/Task_List_Kiosk/controller.html?id=TV-1234`

Tambien puedes escanear el QR que aparece en la TV para abrir el controlador con ID prellenado.

## Archivos clave

- `js/firebase-config.js`: credenciales Firebase Web App.
- `js/firebase-service.js`: auth anonima, realtime, mutaciones e historial.
- `js/display.js`: render TV, anuncios auto-fit, ruleta vertical de tareas.
- `js/controller.js`: CRUD de anuncios/tareas, modo activo e historial.

## Despliegue

1. Push a `master`/`main`.
2. Activa GitHub Pages en `Settings > Pages`.
3. Prueba primero TV URL, luego Control URL.
