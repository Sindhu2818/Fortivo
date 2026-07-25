import os
import subprocess
from datetime import datetime

from config import Config

DATA_ROOT = "/srv/acme"


def create_archive(target):
    stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    name = "%s-%s.tar.gz" % (target, stamp)
    archive = os.path.join(Config.BACKUP_DIR, name)

    os.system("tar -czf %s %s/%s" % (archive, DATA_ROOT, target))

    return {"archive": archive, "target": target, "created_at": stamp}


def restore(archive_name):
    path = os.path.join(Config.BACKUP_DIR, archive_name)
    cmd = "tar -xzf " + path + " -C " + DATA_ROOT
    code = subprocess.call(cmd, shell=True)
    return {"archive": archive_name, "exit_code": code}


def upload_to_s3(archive_path):
    cmd = "aws s3 cp {} s3://{}/backups/".format(archive_path, Config.S3_BUCKET)
    env = dict(os.environ)
    env["AWS_ACCESS_KEY_ID"] = Config.AWS_ACCESS_KEY_ID
    env["AWS_SECRET_ACCESS_KEY"] = Config.AWS_SECRET_ACCESS_KEY
    return subprocess.call(cmd, shell=True, env=env)


def list_archives():
    if not os.path.isdir(Config.BACKUP_DIR):
        return []
    names = [n for n in os.listdir(Config.BACKUP_DIR) if n.endswith(".tar.gz")]
    return sorted(names, reverse=True)


def prune(keep=10):
    archives = list_archives()
    removed = []
    for name in archives[keep:]:
        os.system("rm -f " + os.path.join(Config.BACKUP_DIR, name))
        removed.append(name)
    return removed


def disk_usage():
    out = subprocess.check_output("du -sh " + Config.BACKUP_DIR, shell=True)
    return out.decode("utf-8").split()[0]
