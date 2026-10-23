import type {AppNotification,User} from '../types/treasury';
import {getUserRoles} from './user-roles';
/** A named assignee is exclusive; neither admin observation nor matching display names is delivery authority. */
export function notificationAddressed(n:Pick<AppNotification,'recipientUserId'|'recipientRole'>,viewer:Pick<User,'id'|'role'|'additionalRoles'>):boolean{
 return n.recipientUserId? n.recipientUserId===viewer.id : !!n.recipientRole&&getUserRoles(viewer).includes(n.recipientRole);
}
